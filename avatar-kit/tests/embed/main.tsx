import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { ExecutiveAvatar, type ExecutiveAvatarHandle } from './ExecutiveAvatar';
function App() {
  const ref = useRef<ExecutiveAvatarHandle>(null); const [n, setN] = useState(0);
  (window as any).__h = ref; (window as any).__remount = () => setN(x => x + 1);
  return <div style={{ position: 'fixed', inset: 0 }}><ExecutiveAvatar ref={ref} basePath="/avatar-kit" onReady={() => ((window as any).__ready = true)} onWarning={w => ((window as any).__warn = ((window as any).__warn || []).concat(w.code))} onError={e => ((window as any).__err = e.message)} /></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
