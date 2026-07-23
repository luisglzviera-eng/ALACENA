import type { ReactNode } from 'react';
export const Page=({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode})=><section className="page"><div className="page-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>;
export const Card=({children,className=''}:{children:ReactNode;className?:string})=><div className={`card ${className}`}>{children}</div>;
export const Empty=({children}:{children:ReactNode})=><div className="empty">{children}</div>;
export const DemoBanner=()=> <div className="demo-banner">Modo demostración: agrega tus variables de Supabase para activar sincronización y cuentas reales.</div>;
