import { Fragment, type ReactNode } from 'react';

import { RoleSelect } from './SideNav';

interface Props {
    breadcrumb?: string[];
    title?: ReactNode;
    sub?: ReactNode;
    actions?: ReactNode;
    /** 역할 전환 select 숨기기 (기본: false — 항상 표시). */
    hideRoleSwitch?: boolean;
}

export function PageHeader({ breadcrumb, title, sub, actions, hideRoleSwitch = false }: Props) {
    return (
        <div className="page-header">
            <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                {breadcrumb ? (
                    <div className="page-header__breadcrumb">
                        {breadcrumb.map((b, i) => (
                            <Fragment key={i}>
                                {i > 0 ? <span className="sep">/</span> : null}
                                <span
                                    style={{
                                        color: i === breadcrumb.length - 1 ? 'var(--text-secondary)' : undefined,
                                    }}
                                >
                                    {b}
                                </span>
                            </Fragment>
                        ))}
                    </div>
                ) : null}
                {title ? <h1 className="page-header__title">{title}</h1> : null}
                {sub ? <p className="page-header__sub">{sub}</p> : null}
            </div>
            <div className="row gap-2" style={{ flexShrink: 0, alignItems: 'center' }}>
                {actions}
                {hideRoleSwitch ? null : <RoleSelect />}
            </div>
        </div>
    );
}
