'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useHifiCart } from '@/_shared/contexts/HifiCartContext';
import { Icon, PageHeader, Quicklook, useConfirm, useToast } from '@/_ui/hifi';

export default function CartPage() {
    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();
    const { items: cart, remove, removeMany, totalGb, needCount } = useHifiCart();

    const [sel, setSel] = useState<Set<string>>(() => new Set(cart.map((s) => s.id)));

    useEffect(() => {
        setSel((prev) => new Set([...prev].filter((id) => cart.some((s) => s.id === id))));
    }, [cart]);

    const allChecked = cart.length > 0 && sel.size === cart.length;

    const toggleAll = () => (allChecked ? setSel(new Set()) : setSel(new Set(cart.map((s) => s.id))));
    const toggleOne = (id: string) =>
        setSel((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const removeSelected = async () => {
        if (sel.size === 0) {
            toast('선택된 scene이 없습니다', { tone: 'warning' });
            return;
        }
        const ok = await confirm({
            title: `${sel.size}개 scene 삭제`,
            body: '선택된 scene을 장바구니에서 제거합니다.',
            confirmLabel: '삭제',
            danger: true,
        });
        if (!ok) return;
        removeMany([...sel]);
        toast(`${sel.size}개 삭제됨`, { tone: 'success' });
        setSel(new Set());
    };

    const clearAll = async () => {
        if (cart.length === 0) return;
        const ok = await confirm({
            title: '장바구니 비우기',
            body: `${cart.length}개 scene을 모두 제거합니다.`,
            confirmLabel: '모두 삭제',
            danger: true,
        });
        if (!ok) return;
        removeMany(cart.map((s) => s.id));
        toast('장바구니를 비웠습니다');
    };

    const submit = async () => {
        if (sel.size === 0) {
            toast('선택된 scene이 없습니다', { tone: 'warning' });
            return;
        }
        toast(`${sel.size}건 다운로드 큐에 추가됨`, { tone: 'success', title: '요청 완료' });
        router.push('/plan/sar/user/downloads');
    };

    return (
        <div className="col" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <PageHeader
                breadcrumb={['홈', '장바구니']}
                actions={
                    <>
                        <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => router.push('/plan/sar/user/search')}
                        >
                            ← 검색으로
                        </button>
                        <button
                            type="button"
                            className="btn btn--sm"
                            disabled={cart.length === 0}
                            onClick={clearAll}
                        >
                            <Icon name="trash" size={13} /> 전체 비우기
                        </button>
                    </>
                }
            />
            <div className="col gap-4" style={{ padding: 24, flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div className="kpi">
                        <div className="kpi__label">총 Scene</div>
                        <div className="kpi__value tabular">{cart.length}</div>
                    </div>
                    <div className="kpi">
                        <div className="kpi__label">총 용량</div>
                        <div className="kpi__value tabular">
                            {totalGb.toFixed(1)}
                            <span style={{ fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 4 }}>GB</span>
                        </div>
                    </div>
                    <div className="kpi">
                        <div className="kpi__label">NAS 보유</div>
                        <div className="kpi__value tabular" style={{ color: 'var(--success)' }}>
                            {cart.length - needCount}
                        </div>
                        <div className="kpi__delta">즉시 이용 가능</div>
                    </div>
                    <div className="kpi">
                        <div className="kpi__label">받기 필요</div>
                        <div className="kpi__value tabular" style={{ color: 'var(--warning)' }}>
                            {needCount}
                        </div>
                        <div className="kpi__delta">CDSE → NAS 복사</div>
                    </div>
                </div>

                <div
                    className="card"
                    style={{ flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                    <div className="card__header">
                        <div className="row gap-3">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={allChecked}
                                onChange={toggleAll}
                            />
                            <span style={{ fontWeight: 600 }}>{sel.size} 선택됨</span>
                        </div>
                        <div className="row gap-2">
                            <button
                                type="button"
                                className="btn btn--sm"
                                disabled={sel.size === 0}
                                onClick={removeSelected}
                            >
                                <Icon name="trash" size={12} /> 선택 삭제
                            </button>
                            <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                disabled={sel.size === 0}
                                onClick={submit}
                            >
                                <Icon name="download" size={13} /> 다운로드 요청 ({sel.size})
                            </button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {cart.length === 0 ? (
                            <div className="empty" style={{ padding: '60px 20px' }}>
                                <div className="empty__icon">🛒</div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                    장바구니가 비어있습니다
                                </div>
                                <div style={{ marginTop: 4 }}>검색에서 scene을 담아주세요</div>
                                <button
                                    type="button"
                                    className="btn btn--primary"
                                    style={{ marginTop: 16 }}
                                    onClick={() => router.push('/plan/sar/user/search')}
                                >
                                    <Icon name="search" size={13} /> 검색으로 이동
                                </button>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th className="checkbox-col">
                                            <input
                                                type="checkbox"
                                                className="checkbox"
                                                checked={allChecked}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        <th>Scene</th>
                                        <th>제품</th>
                                        <th>취득</th>
                                        <th>지역</th>
                                        <th className="num">용량</th>
                                        <th>상태</th>
                                        <th style={{ width: 40 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((s) => (
                                        <tr key={s.id} className={sel.has(s.id) ? 'is-selected' : ''}>
                                            <td className="checkbox-col">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox"
                                                    checked={sel.has(s.id)}
                                                    onChange={() => toggleOne(s.id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="row gap-3">
                                                    <Quicklook sceneId={s.id} size={36} />
                                                    <div
                                                        className="mono truncate"
                                                        style={{ fontSize: 11.5, maxWidth: 400 }}
                                                    >
                                                        {s.id}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge--neutral">{s.product}</span>
                                            </td>
                                            <td
                                                className="mono tabular"
                                                style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                                            >
                                                {s.date.slice(0, 10)}
                                            </td>
                                            <td>{s.region}</td>
                                            <td className="num tabular mono" style={{ fontSize: 12 }}>
                                                {s.size}
                                            </td>
                                            <td>
                                                {s.have ? (
                                                    <span className="status status--done">보유</span>
                                                ) : (
                                                    <span className="status status--pending">받기</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn--ghost btn--icon btn--sm"
                                                    onClick={() => {
                                                        remove(s.id);
                                                        toast('제거됨');
                                                    }}
                                                >
                                                    <Icon name="x" size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
