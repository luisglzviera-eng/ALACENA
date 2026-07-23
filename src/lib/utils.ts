export const money = (value:number | null | undefined) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value || 0);
export const fileToBase64 = (file:File) => new Promise<string>((resolve,reject)=>{
  const reader = new FileReader();
  reader.onload=()=>resolve(String(reader.result).split(',')[1] || '');
  reader.onerror=reject;
  reader.readAsDataURL(file);
});
export const uid = () => crypto.randomUUID();
