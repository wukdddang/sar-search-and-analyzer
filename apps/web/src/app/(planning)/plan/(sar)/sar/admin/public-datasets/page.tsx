import { PageHeader } from '@/_ui/hifi';

export default function AdminPublicDatasetsPage() {
    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader breadcrumb={['관리자', '공공 데이터셋']} />
            <div className="empty" style={{ padding: 80 }}>
                <div className="empty__icon">📂</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>공공 데이터셋 관리 UI 준비 중</div>
                <div style={{ marginTop: 4 }}>사용자 화면의 공공 데이터셋을 참고하세요.</div>
            </div>
        </div>
    );
}
