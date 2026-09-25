import { afterEach, expect, it, vi } from 'vitest';
import { getRangeSchedules } from './schedules';
import { emptyFields } from './entities';
afterEach(()=>vi.unstubAllGlobals());
const item={entity_id:'e',title:'',scheduled_date:'2026-09-24',end_date:'2026-09-24',start_time:'09:00',end_time:'10:00',time_zone:'Asia/Tokyo',status:'planned',notes:'',archived:false,created_at:'',updated_at:'',entity_snapshot:emptyFields,tasks:[]};
it('REVIEW: do not silently omit a shifted record between pages',async()=>{
 // Start with 22 records. After page 1, another tab archives record 0.
 // OFFSET 20 then returns record 21, skipping record 20.
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({items:Array.from({length:20},(_,i)=>({...item,id:String(i)})),total:22,limit:20,offset:0}))).mockResolvedValueOnce(new Response(JSON.stringify({items:[{...item,id:'21'}],total:21,limit:20,offset:20})));
 vi.stubGlobal('fetch',fetcher);const rows=await getRangeSchedules('2026-09-01','2026-09-30');console.log('REVIEW pagination',rows.map(r=>r.id));
 expect(rows.map(r=>r.id)).toContain('20');
});
