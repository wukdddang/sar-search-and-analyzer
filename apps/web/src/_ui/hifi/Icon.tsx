import type { SVGProps } from 'react';

export type IconName =
    | 'satellite'
    | 'search'
    | 'cart'
    | 'download'
    | 'folder'
    | 'bell'
    | 'chart'
    | 'users'
    | 'check'
    | 'x'
    | 'refresh'
    | 'globe'
    | 'shield'
    | 'activity'
    | 'layers'
    | 'settings'
    | 'clock'
    | 'server'
    | 'trash'
    | 'plus'
    | 'filter'
    | 'calendar'
    | 'chevronRight'
    | 'chevronDown'
    | 'mapPin'
    | 'polygon'
    | 'square'
    | 'upload'
    | 'sun'
    | 'moon'
    | 'logout';

const SW = 1.75 as const;
const SW2 = 2 as const;

type Props = SVGProps<SVGSVGElement> & { size?: number };

function wrap(paths: React.ReactNode, stroke: number = SW) {
    function IconSvg({ size = 14, ...rest }: Props) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                {...rest}
            >
                {paths}
            </svg>
        );
    }
    return IconSvg;
}

const ICONS: Record<IconName, (p: Props) => React.ReactElement> = {
    satellite: wrap(
        <>
            <path d="M13 7 9 3l-4 4 4 4" />
            <path d="m17 11 4-4-4-4-4 4" />
            <path d="m8 12 4 4" />
            <path d="m16 16 4 4" />
            <path d="m6 10-3 3 4 4 3-3" />
            <path d="m14 18-3 3 4 4 3-3" />
        </>,
    ),
    search: wrap(
        <>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </>,
    ),
    cart: wrap(
        <>
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </>,
    ),
    download: wrap(
        <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
        </>,
    ),
    folder: wrap(
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
    ),
    bell: wrap(
        <>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </>,
    ),
    chart: wrap(
        <>
            <path d="M3 3v18h18" />
            <path d="m7 14 4-4 4 4 5-5" />
        </>,
    ),
    users: wrap(
        <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>,
    ),
    check: wrap(<polyline points="20 6 9 17 4 12" />, SW2),
    x: wrap(
        <>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </>,
        SW2,
    ),
    refresh: wrap(
        <>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
        </>,
    ),
    globe: wrap(
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </>,
    ),
    shield: wrap(
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
    ),
    activity: wrap(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
    layers: wrap(
        <>
            <path d="m12 2 10 6-10 6L2 8z" />
            <path d="m2 14 10 6 10-6" />
        </>,
    ),
    settings: wrap(
        <>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </>,
    ),
    clock: wrap(
        <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </>,
    ),
    server: wrap(
        <>
            <rect width="20" height="8" x="2" y="2" rx="2" />
            <rect width="20" height="8" x="2" y="14" rx="2" />
            <line x1="6" x2="6.01" y1="6" y2="6" />
            <line x1="6" x2="6.01" y1="18" y2="18" />
        </>,
    ),
    trash: wrap(
        <>
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>,
    ),
    plus: wrap(
        <>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </>,
        SW2,
    ),
    filter: wrap(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />),
    calendar: wrap(
        <>
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
        </>,
    ),
    chevronRight: wrap(<path d="m9 18 6-6-6-6" />, SW2),
    chevronDown: wrap(<path d="m6 9 6 6 6-6" />, SW2),
    mapPin: wrap(
        <>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </>,
    ),
    polygon: wrap(<path d="M12 2 4 8v8l8 6 8-6V8z" />),
    square: wrap(<rect x="4" y="4" width="16" height="16" rx="1.5" />),
    upload: wrap(
        <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
        </>,
    ),
    sun: wrap(
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
        </>,
    ),
    moon: wrap(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />),
    logout: wrap(
        <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </>,
    ),
};

export function Icon({ name, size = 14, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
    const Cmp = ICONS[name];
    if (!Cmp) return null;
    return <Cmp size={size} {...rest} />;
}
