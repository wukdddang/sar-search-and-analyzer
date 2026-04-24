'use client';

import { useRef, useState, type DragEvent } from 'react';

import { Icon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './ToastProvider';

type Stage = 'idle' | 'parsing' | 'preview' | 'saving';

interface DbfField {
    name: string;
    type: string;
    length: number;
    decimals: number;
}

interface ParsedBundle {
    baseName: string;
    files: File[];
    encoding: string;
    srs: string;
    geometryType: string;
    bbox: [number, number, number, number];
    recordCount: number;
    fields: DbfField[];
    sampleRows: Record<string, string>[];
    totalBytes: number;
}

interface Props {
    onClose: () => void;
    /** 저장 확정 시 상위가 목업 상태에 반영할 수 있도록 호출. */
    onSaved?: (bundle: ParsedBundle) => void;
}

const SHAPE_TYPES: Record<number, string> = {
    0: 'Null',
    1: 'Point',
    3: 'Polyline',
    5: 'Polygon',
    8: 'MultiPoint',
    11: 'PointZ',
    13: 'PolylineZ',
    15: 'PolygonZ',
    18: 'MultiPointZ',
    21: 'PointM',
    23: 'PolylineM',
    25: 'PolygonM',
    28: 'MultiPointM',
    31: 'MultiPatch',
};

const DBF_TYPE_LABEL: Record<string, string> = {
    C: 'Character',
    N: 'Numeric',
    F: 'Float',
    L: 'Logical',
    D: 'Date',
    M: 'Memo',
};

function detectEncoding(cpgText?: string): string {
    if (!cpgText) return 'utf-8';
    const s = cpgText.trim().toUpperCase().replace(/^UTF[-_]?8.*/, 'UTF-8');
    if (s === 'EUC-KR' || s === 'CP949' || s === 'MS949' || s === '949') return 'euc-kr';
    if (s === 'UTF-8') return 'utf-8';
    return s.toLowerCase();
}

function parsePrjName(text?: string): string {
    if (!text) return '미상 (prj 파일 없음)';
    const m = text.match(/PROJCS\["([^"]+)"/) ?? text.match(/GEOGCS\["([^"]+)"/);
    return m ? m[1] : '알 수 없음';
}

function parseShpHeader(buf: ArrayBuffer): { shapeType: string; bbox: [number, number, number, number] } {
    const v = new DataView(buf);
    const magic = v.getInt32(0, false);
    if (magic !== 9994) throw new Error('유효한 .shp 파일이 아닙니다');
    const shapeTypeCode = v.getInt32(32, true);
    return {
        shapeType: SHAPE_TYPES[shapeTypeCode] ?? `Unknown(${shapeTypeCode})`,
        bbox: [v.getFloat64(36, true), v.getFloat64(44, true), v.getFloat64(52, true), v.getFloat64(60, true)],
    };
}

function parseDbf(
    buf: ArrayBuffer,
    encoding: string,
    sampleLimit: number,
): { recordCount: number; fields: DbfField[]; sampleRows: Record<string, string>[] } {
    const v = new DataView(buf);
    const recordCount = v.getUint32(4, true);
    const headerLength = v.getUint16(8, true);
    const recordLength = v.getUint16(10, true);
    const asciiDecoder = new TextDecoder('latin1');
    const textDecoder = new TextDecoder(encoding);
    const fields: DbfField[] = [];
    let off = 32;
    while (off < headerLength - 1) {
        if (v.getUint8(off) === 0x0d) break;
        const nameBytes = new Uint8Array(buf, off, 11);
        const nullIdx = nameBytes.indexOf(0);
        const name = asciiDecoder.decode(nameBytes.slice(0, nullIdx >= 0 ? nullIdx : 11)).trim();
        fields.push({
            name,
            type: String.fromCharCode(v.getUint8(off + 11)),
            length: v.getUint8(off + 16),
            decimals: v.getUint8(off + 17),
        });
        off += 32;
    }
    const sampleRows: Record<string, string>[] = [];
    const max = Math.min(sampleLimit, recordCount);
    for (let r = 0; r < max; r++) {
        const recStart = headerLength + r * recordLength;
        if (recStart + recordLength > buf.byteLength) break;
        if (v.getUint8(recStart) === 0x2a) continue;
        let col = recStart + 1;
        const row: Record<string, string> = {};
        for (const f of fields) {
            const bytes = new Uint8Array(buf, col, f.length);
            row[f.name] = textDecoder.decode(bytes).trim();
            col += f.length;
        }
        sampleRows.push(row);
    }
    return { recordCount, fields, sampleRows };
}

function humanBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function groupByBase(files: File[]): Record<string, Partial<Record<string, File>>> {
    const out: Record<string, Partial<Record<string, File>>> = {};
    for (const f of files) {
        const m = f.name.match(/^(.+)\.([^.]+)$/);
        if (!m) continue;
        const base = m[1];
        const ext = m[2].toLowerCase();
        if (!['shp', 'dbf', 'prj', 'cpg', 'shx'].includes(ext)) continue;
        out[base] = out[base] ?? {};
        out[base][ext] = f;
    }
    return out;
}

export function ShapefileUploadModal({ onClose, onSaved }: Props) {
    const toast = useToast();
    const [stage, setStage] = useState<Stage>('idle');
    const [bundle, setBundle] = useState<ParsedBundle | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        if (files.length === 0) return;
        setStage('parsing');
        setError(null);
        try {
            const grouped = groupByBase(files);
            const candidates = Object.entries(grouped).filter(([, exts]) => exts.shp && exts.dbf);
            if (candidates.length === 0) {
                throw new Error('.shp 와 .dbf 파일을 같은 basename으로 함께 선택해야 합니다');
            }
            const [base, exts] = candidates[0];
            const shpFile = exts.shp!;
            const dbfFile = exts.dbf!;

            const cpgText = exts.cpg ? await exts.cpg.text() : undefined;
            const encoding = detectEncoding(cpgText);
            const prjText = exts.prj ? await exts.prj.text() : undefined;
            const srs = parsePrjName(prjText);

            const shpBuf = await shpFile.arrayBuffer();
            const { shapeType, bbox } = parseShpHeader(shpBuf);

            const dbfBuf = await dbfFile.arrayBuffer();
            const { recordCount, fields, sampleRows } = parseDbf(dbfBuf, encoding, 5);

            const bundleFiles = [shpFile, dbfFile, exts.prj, exts.cpg, exts.shx].filter((f): f is File => !!f);
            setBundle({
                baseName: base,
                files: bundleFiles,
                encoding,
                srs,
                geometryType: shapeType,
                bbox,
                recordCount,
                fields,
                sampleRows,
                totalBytes: bundleFiles.reduce((a, f) => a + f.size, 0),
            });
            setStage('preview');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setStage('idle');
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
    };

    const handleSave = async () => {
        if (!bundle) return;
        setStage('saving');
        await new Promise((r) => setTimeout(r, 650));
        toast(
            `${bundle.baseName} · ${bundle.recordCount.toLocaleString()}개 레코드, ${bundle.fields.length}개 필드 저장 요청됨`,
            { tone: 'success', title: '목업 — 백엔드 연동 시 DB 반영' },
        );
        onSaved?.(bundle);
        onClose();
    };

    const reset = () => {
        setBundle(null);
        setError(null);
        setStage('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Modal
            title="SHP 업로드"
            sub={
                stage === 'preview' && bundle
                    ? `${bundle.baseName} · ${humanBytes(bundle.totalBytes)}`
                    : 'Shapefile의 속성 테이블을 분석해 DB에 저장합니다'
            }
            size={stage === 'preview' ? 'xl' : 'lg'}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>
                        취소
                    </button>
                    {stage === 'preview' ? (
                        <>
                            <button type="button" className="btn btn--ghost" onClick={reset}>
                                다시 선택
                            </button>
                            <button type="button" className="btn btn--primary" onClick={handleSave}>
                                <Icon name="check" size={13} /> 이 스키마로 DB에 저장
                            </button>
                        </>
                    ) : null}
                    {stage === 'saving' ? (
                        <button type="button" className="btn btn--primary" disabled>
                            저장 중…
                        </button>
                    ) : null}
                </>
            }
        >
            {stage === 'idle' ? (
                <div className="col gap-3">
                    <div
                        className={`shp-drop${dragOver ? ' shp-drop--over' : ''}`}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                        }}
                    >
                        <Icon name="upload" size={28} />
                        <div style={{ marginTop: 10, fontWeight: 600 }}>
                            .shp / .dbf / .prj / .cpg / .shx 파일을 함께 드래그하거나 클릭
                        </div>
                        <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                            동일 basename으로 최소 .shp + .dbf 2개 파일이 필요합니다
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".shp,.dbf,.prj,.cpg,.shx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files) void handleFiles(e.target.files);
                            }}
                        />
                    </div>
                    {error ? (
                        <div className="shp-error">
                            <Icon name="x" size={13} /> {error}
                        </div>
                    ) : null}
                    <div className="faint" style={{ fontSize: 11.5 }}>
                        · .cpg 가 있으면 인코딩(EUC-KR/UTF-8 등)을 자동 감지합니다
                        <br />· .prj 가 있으면 좌표계(PROJCS) 이름을 표시합니다
                        <br />· 속성 테이블(.dbf) 헤더에서 필드 스키마를 추출해 미리 보여줍니다
                    </div>
                </div>
            ) : null}

            {stage === 'parsing' || stage === 'saving' ? (
                <div className="col" style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                    <div className="spinner" />
                    <div className="faint">{stage === 'parsing' ? 'Shapefile 분석 중…' : 'DB 저장 요청 중…'}</div>
                </div>
            ) : null}

            {stage === 'preview' && bundle ? (
                <div className="col gap-4">
                    <div className="shp-stats">
                        <Stat label="레코드 수" value={bundle.recordCount.toLocaleString()} sub="rows" />
                        <Stat label="필드 수" value={`${bundle.fields.length}`} sub="columns" />
                        <Stat label="도형 타입" value={bundle.geometryType} />
                        <Stat label="좌표계" value={bundle.srs} />
                        <Stat label="인코딩" value={bundle.encoding.toUpperCase()} />
                        <Stat label="총 용량" value={humanBytes(bundle.totalBytes)} sub={`${bundle.files.length} files`} />
                    </div>

                    <div>
                        <div className="field-label">경계 상자 (원본 좌표계)</div>
                        <div className="mono tabular" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            X: {bundle.bbox[0].toFixed(3)} ~ {bundle.bbox[2].toFixed(3)} · Y:{' '}
                            {bundle.bbox[1].toFixed(3)} ~ {bundle.bbox[3].toFixed(3)}
                        </div>
                    </div>

                    <div className="shp-two-col">
                        <div className="col gap-2" style={{ minWidth: 0 }}>
                            <div className="between" style={{ alignItems: 'baseline' }}>
                                <div className="field-label">속성 테이블 스키마</div>
                                <span className="faint" style={{ fontSize: 11 }}>
                                    DB에 이 컬럼 구조로 저장됩니다
                                </span>
                            </div>
                            <div className="card shp-preview-card">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 36 }}>#</th>
                                            <th>필드명</th>
                                            <th>DBF</th>
                                            <th className="num">길이</th>
                                            <th className="num">소수</th>
                                            <th>PostgreSQL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bundle.fields.map((f, i) => (
                                            <tr key={f.name}>
                                                <td className="faint mono tabular">{i + 1}</td>
                                                <td className="mono" style={{ fontWeight: 500 }}>
                                                    {f.name}
                                                </td>
                                                <td className="mono" style={{ fontSize: 11.5 }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {f.type}
                                                    </span>
                                                    <span className="faint" style={{ marginLeft: 6 }}>
                                                        {DBF_TYPE_LABEL[f.type] ?? '—'}
                                                    </span>
                                                </td>
                                                <td className="num mono tabular">{f.length}</td>
                                                <td className="num mono tabular">{f.decimals}</td>
                                                <td
                                                    className="mono"
                                                    style={{ fontSize: 11.5, color: 'var(--accent)' }}
                                                >
                                                    {pgTypeOf(f)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="shp-two-col__divider" aria-hidden="true" />

                        <div className="col gap-2" style={{ minWidth: 0 }}>
                            <div className="between" style={{ alignItems: 'baseline' }}>
                                <div className="field-label">샘플 레코드</div>
                                <span className="faint" style={{ fontSize: 11 }}>
                                    상위 {bundle.sampleRows.length}건 · 총 {bundle.recordCount.toLocaleString()}건
                                </span>
                            </div>
                            <div className="card shp-preview-card">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            {bundle.fields.map((f) => (
                                                <th key={f.name} className="mono" style={{ fontSize: 11 }}>
                                                    {f.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bundle.sampleRows.map((row, i) => (
                                            <tr key={i}>
                                                {bundle.fields.map((f) => (
                                                    <td
                                                        key={f.name}
                                                        className="mono"
                                                        style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
                                                    >
                                                        {row[f.name] || <span className="faint">—</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {bundle.sampleRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={bundle.fields.length}
                                                    className="faint"
                                                    style={{ textAlign: 'center', padding: 20 }}
                                                >
                                                    샘플 레코드가 없습니다
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="shp-notice">
                        <Icon name="clock" size={13} />
                        <span>
                            <strong>목업 모드</strong> — 실제 저장은 백엔드(<span className="mono">/api/v1/aois/shapefile</span>) 연동
                            이후 활성화됩니다. 지금은 이 모달에서 업로드 → 속성 테이블 확인 → DB 저장 흐름만 확인 가능합니다.
                        </span>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}

function Stat({ label, value, sub, wide }: { label: string; value: string; sub?: string; wide?: boolean }) {
    return (
        <div className="shp-stat" style={{ gridColumn: wide ? 'span 2' : undefined }}>
            <div className="field-label" style={{ margin: 0 }}>
                {label}
            </div>
            <div className="tabular" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>
                {value}
            </div>
            {sub ? (
                <div className="faint mono tabular" style={{ fontSize: 11 }}>
                    {sub}
                </div>
            ) : null}
        </div>
    );
}

/** DBF 타입을 PostgreSQL 컬럼 타입으로 매핑 — 미리보기 용도. */
function pgTypeOf(f: DbfField): string {
    switch (f.type) {
        case 'C':
            return `varchar(${f.length})`;
        case 'N':
            return f.decimals > 0 ? `numeric(${f.length},${f.decimals})` : f.length > 9 ? 'bigint' : 'integer';
        case 'F':
            return 'double precision';
        case 'L':
            return 'boolean';
        case 'D':
            return 'date';
        case 'M':
            return 'text';
        default:
            return 'text';
    }
}
