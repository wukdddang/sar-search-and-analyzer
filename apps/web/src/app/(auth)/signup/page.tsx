'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { HifiPrefsProvider, Icon, ToastProvider, useToast } from '@/_ui/hifi';

import { AuthHeroPane } from '../_hero';

export default function SignupPage() {
    return (
        <HifiPrefsProvider>
            <ToastProvider>
                <SignupView />
            </ToastProvider>
        </HifiPrefsProvider>
    );
}

interface Fields {
    name: string;
    email: string;
    organization: string;
    phone: string;
    purpose: string;
}

const EMPTY: Fields = { name: '', email: '', organization: '', phone: '', purpose: '' };

function SignupView() {
    const toast = useToast();
    const router = useRouter();
    const [fields, setFields] = useState<Fields>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState<{ requestId: string } | null>(null);

    const update = <K extends keyof Fields>(key: K, value: Fields[K]) =>
        setFields((f) => ({ ...f, [key]: value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!fields.name || !fields.email || !fields.organization || !fields.purpose) {
            toast('필수 항목을 모두 입력하세요', { tone: 'warning' });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
            toast('이메일 형식을 확인하세요', { tone: 'warning' });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(fields),
            });
            const data = (await res.json()) as { ok?: boolean; requestId?: string; error?: string };
            if (!res.ok || !data.ok || !data.requestId) {
                toast(data.error ?? '가입 요청을 처리하지 못했습니다', { tone: 'warning' });
                return;
            }
            toast('관리자에게 알림이 전송되었습니다', { tone: 'success' });
            setSubmitted({ requestId: data.requestId });
        } catch {
            toast('서버와 통신할 수 없습니다', { tone: 'warning' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-0)' }}>
            <AuthHeroPane />
            <div
                style={{
                    flex: '1 1 45%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 32,
                    overflowY: 'auto',
                }}
            >
                <div style={{ width: 400, maxWidth: '100%' }}>
                    {submitted ? (
                        <SuccessPanel requestId={submitted.requestId} onBack={() => router.push('/login')} />
                    ) : (
                        <form onSubmit={submit}>
                            <div
                                style={{
                                    fontSize: 22,
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                회원가입
                            </div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
                                제출하신 정보는 관리자 검토 후 승인 시 사용 가능합니다.
                            </div>
                            <div className="col gap-3">
                                <Field
                                    label="이름"
                                    required
                                    value={fields.name}
                                    onChange={(v) => update('name', v)}
                                    autoComplete="name"
                                />
                                <Field
                                    label="이메일"
                                    required
                                    type="email"
                                    placeholder="you@ksit.re.kr"
                                    value={fields.email}
                                    onChange={(v) => update('email', v)}
                                    autoComplete="email"
                                />
                                <Field
                                    label="소속 기관"
                                    required
                                    placeholder="예) 한국산업기술시험원"
                                    value={fields.organization}
                                    onChange={(v) => update('organization', v)}
                                    autoComplete="organization"
                                />
                                <Field
                                    label="연락처"
                                    placeholder="선택 — 010-0000-0000"
                                    value={fields.phone}
                                    onChange={(v) => update('phone', v)}
                                    autoComplete="tel"
                                />
                                <div>
                                    <label className="field-label">이용 목적 *</label>
                                    <textarea
                                        className="input"
                                        rows={3}
                                        placeholder="간단히 기술해 주세요 (예: 포항 지역 지반 침하 모니터링)"
                                        style={{
                                            width: '100%',
                                            resize: 'vertical',
                                            fontFamily: 'inherit',
                                            padding: '8px 10px',
                                            fontSize: 13,
                                        }}
                                        value={fields.purpose}
                                        onChange={(e) => update('purpose', e.target.value)}
                                    />
                                </div>
                                <div
                                    className="row gap-2"
                                    style={{
                                        padding: 10,
                                        background: 'var(--bg-2)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 8,
                                        fontSize: 11.5,
                                        color: 'var(--text-tertiary)',
                                    }}
                                >
                                    <Icon name="shield" size={12} />
                                    <span>
                                        가입 요청 시{' '}
                                        <b style={{ color: 'var(--text-secondary)' }}>관리자에게 즉시 알림</b>이
                                        전송되며, 승인 여부는 이메일로 안내됩니다.
                                    </span>
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    style={{ height: 38, marginTop: 4 }}
                                    disabled={loading}
                                >
                                    {loading ? '제출 중…' : '가입 요청 →'}
                                </button>
                                <div
                                    className="row gap-2"
                                    style={{
                                        fontSize: 12,
                                        justifyContent: 'center',
                                        color: 'var(--text-tertiary)',
                                        marginTop: 4,
                                    }}
                                >
                                    <span>이미 계정이 있으신가요?</span>
                                    <Link href="/login" style={{ color: 'var(--accent)' }}>
                                        로그인
                                    </Link>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
    autoComplete?: string;
}

function Field({ label, value, onChange, placeholder, type = 'text', required, autoComplete }: FieldProps) {
    return (
        <div>
            <label className="field-label">
                {label}
                {required ? ' *' : null}
            </label>
            <input
                className="input"
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoComplete={autoComplete}
            />
        </div>
    );
}

function SuccessPanel({ requestId, onBack }: { requestId: string; onBack: () => void }) {
    return (
        <div className="col gap-3" style={{ alignItems: 'stretch' }}>
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    alignSelf: 'flex-start',
                }}
            >
                <Icon name="check" size={22} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>가입 요청이 접수되었습니다</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
                관리자에게 알림이 전송되었으며, 검토 후 등록하신 이메일로 승인 결과를 안내해 드립니다. 보통 1영업일
                이내 처리됩니다.
            </div>
            <div
                className="col gap-1"
                style={{
                    padding: 12,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    fontSize: 12,
                }}
            >
                <div className="between">
                    <span className="faint">요청 번호</span>
                    <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                        {requestId}
                    </span>
                </div>
            </div>
            <button type="button" className="btn btn--primary" style={{ height: 38 }} onClick={onBack}>
                로그인 페이지로
            </button>
        </div>
    );
}
