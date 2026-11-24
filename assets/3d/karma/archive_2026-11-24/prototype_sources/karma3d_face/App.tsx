import React, { useEffect, useRef, useState } from 'react';
import { Callout, Closing, FileCard, Group, Header } from '@instinct/files';
import { startKarma, Controls } from './engine';

const SCIENTISTS = [
    { name: 'فاروق الباز', field: 'علوم الأرض والفضاء' },
    { name: 'أحمد زويل', field: 'كيمياء الفيمتو' },
    { name: 'مجدي يعقوب', field: 'جراحة القلب' },
    { name: 'علي مصطفى مشرفة', field: 'الفيزياء النظرية' },
];
const HEIGHTS = [
    [150, 110, 170, 130],
    [100, 165, 120, 160],
    [170, 130, 95, 150],
    [120, 150, 165, 105],
];
const STATE_AR: Record<string, string> = { idle: 'واقفة', walk: 'بتمشي', jump: 'بتنط', fall: 'بتنزل', lean: 'بتسند على الكارت', wave: 'بتسلّم' };

function Stage() {
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctl = useRef<Controls>({ left: false, right: false, jump: false, auto: true });
    const api = useRef<ReturnType<typeof startKarma> | null>(null);
    const [auto, setAuto] = useState(true);
    const [layout, setLayout] = useState(0);
    const [state, setState] = useState('idle');
    const [webgl, setWebgl] = useState(true);

    useEffect(() => {
        if (!stageRef.current || !canvasRef.current) return;
        try { api.current = startKarma(stageRef.current, canvasRef.current, ctl.current, setState); }
        catch { setWebgl(false); }
        return () => api.current?.stop();
    }, []);

    const manual = () => { ctl.current.auto = false; setAuto(false); };
    const key = (down: boolean) => (e: React.KeyboardEvent) => {
        const c = ctl.current; const k = e.key;
        const map: Record<string, 'left' | 'right' | 'jump'> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump' };
        if (!map[k]) return;
        e.preventDefault(); if (down) manual(); c[map[k]] = down;
    };
    const hold = (name: 'left' | 'right' | 'jump') => ({
        onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); manual(); ctl.current[name] = true; },
        onPointerUp: () => { ctl.current[name] = false; },
        onPointerLeave: () => { ctl.current[name] = false; },
        onPointerCancel: () => { ctl.current[name] = false; },
    });
    const hs = HEIGHTS[layout % HEIGHTS.length];

    return <div>
        <div className="kp-stage" ref={stageRef} tabIndex={0} onKeyDown={key(true)} onKeyUp={key(false)} aria-label="مسرح كارما التفاعلي">
            <div className="kp-row">
                {SCIENTISTS.map((s, i) => <div key={s.name} className={`kp-card kp-c${i}`} data-solid style={{ height: hs[i] }}>
                    <div className="kp-initial">{s.name.replace('علي ', '').charAt(0)}</div>
                    <div className="kp-name">{s.name}</div>
                    <div className="kp-field">{s.field}</div>
                </div>)}
            </div>
            <div className="kp-floor" data-floor />
            <canvas ref={canvasRef} className="kp-canvas" />
            {!webgl && <div className="kp-nowebgl">المتصفح ده مش بيشغّل WebGL، فكارما مش هتظهر هنا.</div>}
            <div className="kp-state">الحالة: {STATE_AR[state] || state}</div>
        </div>
        <div className="kp-controls">
            <button type="button" className="file-button is-compact" data-variant={auto ? 'primary' : 'secondary'} onClick={() => { const v = !ctl.current.auto; ctl.current.auto = v; setAuto(v); }}>{auto ? 'تلقائي: شغّال' : 'تلقائي: واقف'}</button>
            <button type="button" className="file-button is-compact" data-variant="secondary" onClick={() => { setLayout((l) => l + 1); }}>غيّر ترتيب الكروت</button>
            <button type="button" className="file-button is-compact" data-variant="secondary" onClick={() => api.current?.reset()}>رجّعها من الأول</button>
        </div>
        <div className="kp-pad">
            <button type="button" className="file-button" data-variant="secondary" {...hold('left')}>◀</button>
            <button type="button" className="file-button" data-variant="secondary" {...hold('jump')}>نطّ</button>
            <button type="button" className="file-button" data-variant="secondary" {...hold('right')}>▶</button>
        </div>
    </div>;
}

export function App() {
    return <FileCard>
        <Header title="كارما بتتحرك بين كروت الحكايات" fact="تجربة بالكود، مش فيديو" intro="كارما هنا مجسّم ثلاثي الأبعاد بيتحرك لحظة بلحظة، ووشها مأخوذ من صورها. الكروت منصّات حقيقية: بتقف عليها، وتسند على جنبها، وتنط بينها." />
        <Group label="جرّبها" heading>
            <Stage />
            <p className="kp-hint">اضغط على المسرح وبعدها استخدم الأسهم أو A/D للمشي وSpace للنط. على الموبايل استخدم الأزرار تحت. زر «غيّر ترتيب الكروت» يوريك إنها بتحس بالتغيير: بتقيس مكان وحجم كل كارت في كل لحظة.</p>
        </Group>
        <Group label="اللي لازم تعرفه" heading>
            <Callout title="مجسّم حقيقي من صورة كارما، لسه بتحريك مبسّط" tone="warning">المجسّم ثلاثي الأبعاد طالع من صورة كارما نفسها بأداة مجانية (TRELLIS.2)، فاللبس والشعر والوش من صورتها. بس هو شبكة واحدة من صورة أمامية، فالجنب والضهر تخمين من الأداة، والتفاصيل الصغيرة زي الوش والشعر مبسّطة. السلام برفع الإيد وتحريك الدراع. الحركة بهيكل عظمي بسيط فيه ركب ومرافق (رجلين وإيدين وراس)، من غير حركة صوابع أو وش، والشعر ثابت مع الراس. الوش متركّب من نقاط وش MediaPipe Face Mesh (ترخيص Apache 2.0، جوجل) مع صورة كارما.</Callout>
            <Callout title="تحميل أول مرة تقيل" tone="info">المجسّم بخامته الأصلية حوالي 13 ميجا، فأول تحميل ممكن ياخد وقت على النت البطيء أو الموبايلات الضعيفة.</Callout>
            <Callout title="دي صفحة تجربة منفصلة" tone="info">محدش غيّر موقع خالدون المنشور. الكروت هنا مثال، ومش من صفحة الحكايات الحقيقية.</Callout>
        </Group>
        <Closing>الحركة محسوبة بالكود: جاذبية، تصادم مع حواف الكروت، ومشي ونطّ وسند. مفيش حاجة مسجّلة.</Closing>
    </FileCard>;
}
