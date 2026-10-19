/** Logo de Alacena: casa con repisas. Toma el color del texto (currentColor). */
export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="22 18 56 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Alacena">
      <path d="M22 46 50 22l28 24v32H22z" strokeWidth="6" />
      <path d="M32 58h36M32 70h36" strokeWidth="5" />
      <circle cx="42" cy="52" r="3.4" fill="currentColor" stroke="none" />
      <circle cx="58" cy="64" r="3.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
