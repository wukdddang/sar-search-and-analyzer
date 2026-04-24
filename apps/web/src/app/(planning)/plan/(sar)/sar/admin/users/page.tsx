'use client';

import { useMemo, useState } from 'react';

import { Icon, PageHeader, useConfirm, useToast } from '@/_ui/hifi';

type UserStatus = 'active' | 'pending' | 'inactive';
type UserRole = 'admin' | 'downloader' | 'viewer' | 'pending';

interface User {
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    joined: string;
    last: string;
}

const INITIAL: User[] = [
    { email: 'kim@ksit.re.kr', name: '김연구원', role: 'downloader', status: 'active', joined: '2025-08-12', last: '2분 전' },
    { email: 'park@ksit.re.kr', name: '박지수', role: 'downloader', status: 'active', joined: '2025-09-03', last: '15분 전' },
    { email: 'lee@labs.kr', name: '이민호', role: 'viewer', status: 'active', joined: '2026-01-14', last: '1시간 전' },
    { email: 'choi@univ.ac.kr', name: '최윤라', role: 'pending', status: 'pending', joined: '2026-04-23', last: '—' },
    { email: 'jung@ksit.re.kr', name: '정소현', role: 'pending', status: 'pending', joined: '2026-04-24', last: '—' },
    { email: 'hong@ksit.re.kr', name: '홍길동', role: 'admin', status: 'active', joined: '2024-03-01', last: '어제' },
    { email: 'yoon@ksit.re.kr', name: '윤재민', role: 'viewer', status: 'inactive', joined: '2025-02-20', last: '3개월 전' },
];

export default function UsersPage() {
    const toast = useToast();
    const confirm = useConfirm();
    const [users, setUsers] = useState<User[]>(INITIAL);
    const [q, setQ] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
    const [roleFilter, setRoleFilter] = useState<'전체' | UserRole>('전체');

    const filtered = useMemo(
        () =>
            users.filter((u) => {
                if (q && !u.email.toLowerCase().includes(q.toLowerCase()) && !u.name.includes(q)) return false;
                if (statusFilter !== 'all' && u.status !== statusFilter) return false;
                if (roleFilter !== '전체' && u.role !== roleFilter) return false;
                return true;
            }),
        [users, q, statusFilter, roleFilter],
    );

    const counts = useMemo(
        () => ({
            all: users.length,
            pending: users.filter((u) => u.status === 'pending').length,
            active: users.filter((u) => u.status === 'active').length,
            inactive: users.filter((u) => u.status === 'inactive').length,
        }),
        [users],
    );

    const approve = (email: string) => {
        setUsers((prev) =>
            prev.map((u) =>
                u.email === email ? { ...u, status: 'active' as UserStatus, role: 'viewer' as UserRole, last: '방금' } : u,
            ),
        );
        toast(`${email} 승인됨`, { tone: 'success' });
    };
    const reject = async (email: string) => {
        const ok = await confirm({
            title: '가입 거절',
            body: `${email} 사용자의 가입을 거절합니다.`,
            confirmLabel: '거절',
            danger: true,
        });
        if (!ok) return;
        setUsers((prev) => prev.filter((u) => u.email !== email));
        toast(`${email} 거절됨`);
    };

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['관리자', '사용자']}
                actions={
                    <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => toast('초대 메일 입력 폼 준비 중')}
                    >
                        <Icon name="plus" size={13} /> 초대
                    </button>
                }
            />
            <div className="toolbar">
                <input
                    className="input input--search"
                    placeholder="이메일 / 이름 검색…"
                    style={{ width: 320 }}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <div className="row gap-1">
                    <span
                        className={`chip${statusFilter === 'all' ? ' chip--active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        전체 {counts.all}
                    </span>
                    <span
                        className={`chip${statusFilter === 'pending' ? ' chip--active' : ''}`}
                        onClick={() => setStatusFilter('pending')}
                    >
                        승인 대기{' '}
                        <span
                            className="badge badge--warning"
                            style={{ marginLeft: 4, padding: '0 6px', fontSize: 10 }}
                        >
                            {counts.pending}
                        </span>
                    </span>
                    <span
                        className={`chip${statusFilter === 'active' ? ' chip--active' : ''}`}
                        onClick={() => setStatusFilter('active')}
                    >
                        활성 {counts.active}
                    </span>
                    <span
                        className={`chip${statusFilter === 'inactive' ? ' chip--active' : ''}`}
                        onClick={() => setStatusFilter('inactive')}
                    >
                        비활성 {counts.inactive}
                    </span>
                </div>
                <div className="row gap-2" style={{ marginLeft: 'auto' }}>
                    <span className="faint" style={{ fontSize: 12 }}>
                        역할
                    </span>
                    <select
                        className="select"
                        style={{ width: 140 }}
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as '전체' | UserRole)}
                    >
                        <option>전체</option>
                        <option>admin</option>
                        <option>downloader</option>
                        <option>viewer</option>
                        <option>pending</option>
                    </select>
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <div className="card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="checkbox-col">
                                    <input type="checkbox" className="checkbox" />
                                </th>
                                <th>사용자</th>
                                <th>역할</th>
                                <th>상태</th>
                                <th>가입일</th>
                                <th>최근 활동</th>
                                <th style={{ width: 180 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="empty" style={{ padding: 40 }}>
                                        일치하는 사용자가 없습니다
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((u) => (
                                    <tr
                                        key={u.email}
                                        style={
                                            u.status === 'pending'
                                                ? { background: 'var(--warning-soft)' }
                                                : undefined
                                        }
                                    >
                                        <td className="checkbox-col">
                                            <input type="checkbox" className="checkbox" />
                                        </td>
                                        <td>
                                            <div className="row gap-3">
                                                <div
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: '50%',
                                                        background:
                                                            'linear-gradient(135deg, var(--accent), var(--brand-2))',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--accent-fg)',
                                                        fontWeight: 600,
                                                        fontSize: 11,
                                                    }}
                                                >
                                                    {u.name.slice(0, 2)}
                                                </div>
                                                <div className="col" style={{ gap: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>{u.name}</div>
                                                    <div className="mono faint" style={{ fontSize: 11.5 }}>
                                                        {u.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {u.role === 'pending' ? (
                                                <span className="badge badge--warning">승인 필요</span>
                                            ) : u.role === 'admin' ? (
                                                <span className="badge badge--brand2">admin</span>
                                            ) : u.role === 'downloader' ? (
                                                <span className="badge badge--accent">downloader</span>
                                            ) : (
                                                <span className="badge badge--neutral">viewer</span>
                                            )}
                                        </td>
                                        <td>
                                            {u.status === 'active' ? (
                                                <span className="status status--done">활성</span>
                                            ) : u.status === 'pending' ? (
                                                <span className="status status--pending">대기</span>
                                            ) : (
                                                <span className="status status--queued">비활성</span>
                                            )}
                                        </td>
                                        <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                            {u.joined}
                                        </td>
                                        <td className="faint" style={{ fontSize: 12 }}>
                                            {u.last}
                                        </td>
                                        <td>
                                            <div className="row gap-1">
                                                {u.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn--outline-accent btn--sm"
                                                            onClick={() => approve(u.email)}
                                                        >
                                                            승인
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn--ghost btn--sm"
                                                            onClick={() => reject(u.email)}
                                                        >
                                                            거절
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn--ghost btn--sm"
                                                            onClick={() => toast('사용자 편집 패널 준비 중')}
                                                        >
                                                            편집
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn--ghost btn--icon btn--sm"
                                                            data-tooltip="더보기"
                                                            onClick={() => toast('메뉴 준비 중')}
                                                        >
                                                            ⋯
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
