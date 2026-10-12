'use client';
import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Check,ChevronDown,Focus,Layers,Plus,Save,SlidersHorizontal,Trash2,X,ZoomIn,ZoomOut,Network,ArrowUpRight} from 'lucide-react';
import SplitWorkspace from './SplitWorkspace';
import {spaceName} from '@/lib/chat';
import {type Store,type Entry,uid} from '@/lib/model';
import {arrangePlanets,defaultCamera,spaceStore,DWARF_ID,captureBaseline,notePositions,planetRadius,planetSimilarities,visibleEntries,zoomAt,type Point,type UniverseState,type UniverseView} from '@/lib/universe';

type Props={store:Store;save:(state:UniverseState,views?:UniverseView[])=>boolean;create:(name:string,color:string)=>boolean;remove:(id:string)=>boolean;open:(id:string)=>void;classify:(id:string)=>void};
const title=(entry:Entry)=>entry.title||entry.body.split('\n')[0].slice(0,45)||'Untitled';

export default function UniverseWorkspace(props:Props){
  const {create,remove,open,classify}=props;
  const store=useMemo(()=>spaceStore(props.store),[props.store]);
  const [state,setState]=useState<UniverseState>(()=>store.universe?{...store.universe,planetIds:store.universe.positions[DWARF_ID]?store.universe.planetIds:[...store.universe.planetIds,DWARF_ID]}:{planetIds:store.planets.map(p=>p.id),positions:arrangePlanets(store.planets,store.entries),camera:{...defaultCamera}});
  const [panel,setPanel]=useState<'keywords'|'views'|'nodes'|null>('keywords'),[selected,setSelected]=useState<string|null>(null),[name,setName]=useState<string|null>(null),[notice,setNotice]=useState('');
  const [creating,setCreating]=useState(false),[createName,setCreateName]=useState(''),[createColor,setCreateColor]=useState('#adc5ef'),[pendingDelete,setPendingDelete]=useState<string|null>(null);
  const [selectedPlanet,setSelectedPlanet]=useState<string|null>(null);
  const area=useRef<HTMLDivElement>(null),stateRef=useRef(state),propsRef=useRef(props),timer=useRef<ReturnType<typeof setTimeout>|null>(null),noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const size=useRef({width:1000,height:700}),[dimensions,setDimensions]=useState({width:0,height:0});
  const drag=useRef<{id?:string;pointer:number;start:Point;origin:Point;moved:boolean}|null>(null),pointers=useRef(new Map<number,Point>()),pinch=useRef<{distance:number;center:Point}|null>(null),ignoreClick=useRef(false);
  propsRef.current={...props,store};
  useEffect(()=>{
    if(name===null)return;
    const before=document.activeElement as HTMLElement;
    const handler=(event:KeyboardEvent)=>{if(event.key==='Escape')setName(null);if(event.key==='Tab'){
      const elements=document.querySelectorAll<HTMLElement>('.cosmos-save input,.cosmos-save button:not(:disabled)');
      if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }};
    document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);before?.focus()};
  },[name===null]);
  const priorIds=useRef(store.planets.map(p=>p.id));
  const layoutKey=store.entries.map(e=>`${e.id}:${e.planetIds.join(',')}`).join(';');
  useEffect(()=>{
    const current=stateRef.current;
    if(current.layoutKey===layoutKey||current.manual||current.activeViewId)return;
    const visible=propsRef.current.store.planets.filter(p=>current.planetIds.includes(p.id));
    update({...current,layoutKey,positions:{...current.positions,...arrangePlanets(visible,propsRef.current.store.entries)}});
  },[layoutKey]);
  function message(text:string){setNotice(text);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(''),2800)}
  function persist(next:UniverseState,views?:UniverseView[]){if(timer.current)clearTimeout(timer.current);timer.current=null;return propsRef.current.save(next,views)}
  function update(next:UniverseState){stateRef.current=next;setState(next);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{timer.current=null;propsRef.current.save(stateRef.current)},350)}
  useEffect(()=>{const flush=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;propsRef.current.save(stateRef.current)}};window.addEventListener('pagehide',flush);return()=>window.removeEventListener('pagehide',flush)},[]);
  useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);propsRef.current.save(stateRef.current)}if(noticeTimer.current)clearTimeout(noticeTimer.current)},[]);
  useEffect(()=>{
    const ids=store.planets.map(p=>p.id),added=ids.filter(id=>!priorIds.current.includes(id));
    priorIds.current=ids;
    const current=stateRef.current,valid=current.planetIds.filter(id=>ids.includes(id));
    const missing=ids.filter(id=>!current.positions[id]);
    if(added.length||valid.length!==current.planetIds.length||missing.length){
      const auto=arrangePlanets(store.planets,store.entries),positions={...current.positions};
      for(const id of missing)positions[id]=auto[id];
      update({...current,planetIds:[...new Set([...valid,...added])],positions});
    }
  },[store.planets]);
  useEffect(()=>{
    const element=area.current;if(!element)return;
    const resize=new ResizeObserver(()=>{size.current={width:element.clientWidth,height:element.clientHeight};setDimensions(size.current)});resize.observe(element);
    const wheel=(event:WheelEvent)=>{event.preventDefault();const r=element.getBoundingClientRect();const point={x:event.clientX-r.left-r.width/2,y:event.clientY-r.top-r.height/2};const current=stateRef.current;update({...current,camera:zoomAt(current.camera,point,current.camera.zoom*Math.exp(-event.deltaY*.0015))})};
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>{resize.disconnect();element.removeEventListener('wheel',wheel)};
  },[]);
  const planets=store.planets.filter(p=>state.planetIds.includes(p.id));
  const positions=useMemo(()=>Object.fromEntries(planets.filter(p=>state.positions[p.id]).map(p=>[p.id,state.positions[p.id]])),[state.positions,store.planets,state.planetIds]);
  const entries=useMemo(()=>visibleEntries(store.entries,state.planetIds),[store.entries,state.planetIds]);
  const nodes=useMemo(()=>notePositions(entries,planets,positions),[entries,store.planets,positions]);
  const links=useMemo(()=>planetSimilarities(planets,store.entries).filter(p=>p.similarity>.05),[store.planets,store.entries,state.planetIds]);
  const preview=store.entries.find(e=>e.id===selected),active=(store.views??[]).find(v=>v.id===state.activeViewId),camera=state.camera;
  const dirty=active?JSON.stringify([active.planetIds,active.positions,active.camera,active.baseline?.id])!==JSON.stringify([state.planetIds,state.positions,state.camera,state.baseline?.id]):false;
  function fit(next=stateRef.current){
    const ps=store.planets.filter(p=>next.planetIds.includes(p.id));const es=visibleEntries(store.entries,next.planetIds),ns=notePositions(es,ps,next.positions);
    const points=[...ps.flatMap(p=>{const pos=next.positions[p.id];if(!pos)return [];const r=planetRadius(p.entryCount)+70;return [{x:pos.x-r,y:pos.y-r},{x:pos.x+r,y:pos.y+r}]}),...Object.values(ns)];
    if(!points.length){update({...next,camera:{...defaultCamera}});return}
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const zoom=Math.max(.2,Math.min(1.3,(size.current.width-100)/Math.max(1,maxX-minX),(size.current.height-140)/Math.max(1,maxY-minY)));
    update({...next,camera:{zoom,x:-(minX+maxX)/2*zoom,y:-(minY+maxY)/2*zoom}});
  }
  const fitted=useRef(false);
  useEffect(()=>{if(dimensions.width>0&&!fitted.current){fitted.current=true;if(!store.universe)fit()}},[dimensions]);
  function down(event:ReactPointerEvent<SVGSVGElement>){
    if(event.button!==0)return;
    const target=event.target as Element;if(target.closest('[data-note]'))return;
    const id=target.closest('[data-planet]')?.getAttribute('data-planet')??undefined;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});event.currentTarget.setPointerCapture(event.pointerId);
    if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};drag.current=null;ignoreClick.current=true;return}
    drag.current={id,pointer:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:id?{...stateRef.current.positions[id]}:{x:stateRef.current.camera.x,y:stateRef.current.camera.y},moved:false};ignoreClick.current=false;
  }
  function move(event:ReactPointerEvent<SVGSVGElement>){
    if(!pointers.current.has(event.pointerId))return;pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.current.size===2&&pinch.current&&area.current){
      const [a,b]=[...pointers.current.values()],d=Math.hypot(a.x-b.x,a.y-b.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},rect=area.current.getBoundingClientRect(),old=pinch.current;
      const next=zoomAt(stateRef.current.camera,{x:old.center.x-rect.left-rect.width/2,y:old.center.y-rect.top-rect.height/2},stateRef.current.camera.zoom*d/Math.max(1,old.distance));
      next.x+=center.x-old.center.x;next.y+=center.y-old.center.y;update({...stateRef.current,camera:next});pinch.current={distance:d,center};return;
    }
    const d=drag.current;if(!d||d.pointer!==event.pointerId)return;const dx=event.clientX-d.start.x,dy=event.clientY-d.start.y;
    if(Math.hypot(dx,dy)>4)d.moved=true;if(!d.moved)return;ignoreClick.current=true;
    const current=stateRef.current;
    if(d.id)update({...current,manual:true,positions:{...current.positions,[d.id]:{x:d.origin.x+dx/current.camera.zoom,y:d.origin.y+dy/current.camera.zoom}}});
    else update({...current,camera:{...current.camera,x:d.origin.x+dx,y:d.origin.y+dy}});
  }
  function end(event:ReactPointerEvent<SVGSVGElement>){const d=drag.current;if(event.type==='pointerup'&&d?.id&&!d.moved&&!pinch.current){ignoreClick.current=false;focusPlanet(d.id)}pointers.current.delete(event.pointerId);pinch.current=null;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
  function focusPlanet(id:string){if(ignoreClick.current)return;setSelectedPlanet(id);setSelected(null);setPanel('nodes');const pos=stateRef.current.positions[id],zoom=stateRef.current.camera.zoom;update({...stateRef.current,camera:{zoom,x:-pos.x*zoom,y:-pos.y*zoom}})}
  function showNode(id:string){setSelected(id);setPanel('nodes')}
  function baseline(){const saved=captureBaseline(stateRef.current.planetIds,stateRef.current.positions);const next={...stateRef.current,baseline:saved,manual:true};update(next);persist(next);message('Relationship baseline saved')}
  function saveView(){if(name===null||!name.trim())return;const id=uid(),view={...stateRef.current,id,name:name.trim(),activeViewId:id};const next={...stateRef.current,activeViewId:id};if(persist(next,[...(store.views??[]),view])){stateRef.current=next;setState(next);setName(null);message('View saved')}}
  function switchView(view:UniverseView){const next={planetIds:view.planetIds.filter(id=>store.planets.some(p=>p.id===id)),positions:view.positions,camera:view.camera,activeViewId:view.id,manual:view.manual,baseline:view.baseline};update(next);persist(next);setPanel(null);setSelected(null)}
  const listed=selectedPlanet?store.entries.filter(e=>e.planetIds.includes(selectedPlanet)):entries;
  const selectedParent=store.planets.find(p=>p.id===selectedPlanet);
  const sidePanel=panel?<div className="space-inspector">
    <header className="inspector-tabs"><div>{[['keywords','모행성'],['nodes','Pages'],['views','Views']].map(([id,label])=><button key={id} aria-pressed={panel===id} onClick={()=>{setPanel(id as 'keywords'|'nodes'|'views');setSelected(null)}}>{label}</button>)}</div><button aria-label="Close side panel" onClick={()=>{setPanel(null);setSelected(null)}}><X size={18}/></button></header>
    <div className="inspector-content">
    {panel==='keywords'?<><h2>모행성</h2><div className="cosmos-panel-actions"><button onClick={()=>update({...stateRef.current,planetIds:store.planets.map(p=>p.id)})}>Select all</button><button onClick={()=>update({...stateRef.current,planetIds:[]})}>Clear</button></div><div className="cosmos-keywords">{store.planets.map(p=><div key={p.id}><label><input type="checkbox" checked={state.planetIds.includes(p.id)} onChange={e=>update({...stateRef.current,planetIds:e.target.checked?[...stateRef.current.planetIds,p.id]:stateRef.current.planetIds.filter(id=>id!==p.id)})}/><i style={{background:p.color}}/><span>{p.name}</span><small>{p.entryCount}</small></label>{p.id!==DWARF_ID&&<button aria-label={`Delete ${p.name}`} onClick={()=>setPendingDelete(p.id)}><Trash2 size={14}/></button>}</div>)}</div>{pendingDelete&&<div className="inline-planet-form"><p>Remove {store.planets.find(p=>p.id===pendingDelete)?.name}? Nodes will be kept.</p><div className="inline-actions"><button onClick={()=>setPendingDelete(null)}>Cancel</button><button onClick={()=>{if(remove(pendingDelete))setPendingDelete(null)}}>Remove 모행성</button></div></div>}{creating?<form className="inline-planet-form" onSubmit={e=>{e.preventDefault();if(createName.trim()&&!store.planets.some(p=>p.name.toLowerCase()===createName.trim().toLowerCase())&&create(createName.trim(),createColor)){setCreating(false);setCreateName('')}}}><label>모행성 name<input aria-label="New 모행성 name" autoFocus value={createName} onChange={e=>setCreateName(e.target.value)} maxLength={20} required/></label><div className="inline-colors">{['#adc5ef','#d3c6ec','#c9dccb','#e9c7b4','#eddcaa'].map(color=><button key={color} type="button" aria-label={`Choose ${color}`} aria-pressed={createColor===color} style={{background:color}} onClick={()=>setCreateColor(color)}>{createColor===color&&<Check size={14}/>}</button>)}</div>{store.planets.some(p=>p.name.toLowerCase()===createName.trim().toLowerCase())&&<p className="field-error">This name is already in use.</p>}<div className="inline-actions"><button type="button" onClick={()=>setCreating(false)}>Cancel</button><button disabled={!createName.trim()||store.planets.some(p=>p.name.toLowerCase()===createName.trim().toLowerCase())}>Create</button></div></form>:<button className="cosmos-add" onClick={()=>setCreating(true)}><Plus size={16}/>Create 모행성</button>}<section className="baseline-card"><h3>Relationship baseline</h3><p>Drag 모행성 to set the distance you have in mind.</p><button onClick={baseline} disabled={planets.filter(p=>p.id!==DWARF_ID).length<2}><Save size={15}/>{state.baseline?'Update baseline':'Capture baseline'}</button>{state.baseline&&<><time>Saved {new Date(state.baseline.createdAt).toLocaleString('en-US')}</time><small>{state.baseline.distances.length} distances · AI suggestions not connected</small></>}</section></>
    :panel==='views'?<><h2>Saved views</h2>{(store.views??[]).map(v=><div className="cosmos-saved" key={v.id}><button onClick={()=>switchView(v)}><span>{v.name}{active?.id===v.id&&<Check size={13}/>}</span><small>{v.planetIds.map(id=>store.planets.find(p=>p.id===id)?.name).filter(Boolean).join(' · ')}</small></button><button aria-label={`Delete view ${v.name}`} onClick={()=>{const next={...stateRef.current,activeViewId:stateRef.current.activeViewId===v.id?undefined:stateRef.current.activeViewId};if(persist(next,store.views?.filter(s=>s.id!==v.id))){setState(next);stateRef.current=next}}}><Trash2 size={14}/></button></div>)}{!store.views?.length&&<p className="inspector-empty">No saved views yet.</p>}{active&&<button className="cosmos-add" disabled={!dirty} onClick={()=>{if(persist(stateRef.current,store.views?.map(v=>v.id===active.id?{...v,...stateRef.current}:v)))message('View updated')}}><Save size={15}/>Update current view</button>}<button className="cosmos-add" onClick={()=>setName('')}><Plus size={16}/>Save as a new view</button></>
    :preview?<article className="node-reading"><button className="text-button" onClick={()=>setSelected(null)}>← {selectedParent?.name??'Pages'}</button><h2>{title(preview)}</h2><time>{new Date(preview.createdAt).toLocaleDateString('en-US')}</time><p>{preview.body||'No body text'}</p><div className="cosmos-preview-tags">{preview.planetIds.map(id=><span key={id}>{store.planets.find(p=>p.id===id)?.name}</span>)}</div><footer><button onClick={()=>classify(preview.id)}>Classify</button><button onClick={()=>open(preview.id)}>Open original <ArrowUpRight size={15}/></button></footer></article>
    :<><div className="page-list-title"><h2>{selectedParent?.name??'Pages'}</h2><span>{listed.length}</span></div>{selectedPlanet&&<button className="text-button" onClick={()=>setSelectedPlanet(null)}>All visible pages</button>}<div className="planet-pages">{listed.map(e=><button key={e.id} onClick={()=>showNode(e.id)}><strong>{title(e)}</strong><p>{e.body.slice(0,130)}</p><time>{new Date(e.createdAt).toLocaleDateString('en-US')}</time></button>)}</div>{!listed.length&&<p className="inspector-empty">No pages in this 모행성 yet.</p>}</>}
    </div></div>:null;
  return <section className="space-page" aria-label={spaceName(store.profile)}><SplitWorkspace storageKey="moons.space.panel.width" panel={sidePanel}><div className="cosmos-shell">
    <div className="cosmos-toolbar">
      <button onClick={()=>setPanel(panel==='views'?null:'views')} aria-expanded={panel==='views'} className="cosmos-view-button"><Layers size={16}/><span>{active?.name??spaceName(store.profile)}{dirty?' · edited':''}</span><ChevronDown size={14}/></button>
      <div className="cosmos-tools"><button title="Choose 모행성" aria-label="Choose 모행성" aria-expanded={panel==='keywords'} onClick={()=>setPanel(panel==='keywords'?null:'keywords')}><SlidersHorizontal size={18}/></button><button title="Arrange by shared notes and text overlap (AI not connected)" aria-label="Arrange by similarity" onClick={()=>{fit({...stateRef.current,manual:false,positions:{...stateRef.current.positions,...arrangePlanets(planets,store.entries)}});message('Arranged by similarity')}}><Network size={18}/></button><button onClick={()=>setName('')} aria-label="Save as a new view" title="Save as a new view"><Save size={17}/></button></div>
    </div>
    <div className="cosmos-canvas" ref={area}>
      <svg className="cosmos-svg" aria-label="Space graph" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <g transform={`translate(${dimensions.width/2+camera.x} ${dimensions.height/2+camera.y}) scale(${camera.zoom})`}>
          <g className="cosmos-links">{links.map(l=>positions[l.a]&&positions[l.b]?<line key={l.a+l.b} x1={positions[l.a].x} y1={positions[l.a].y} x2={positions[l.b].x} y2={positions[l.b].y} strokeOpacity={.16+l.similarity*.3} strokeDasharray="3 6"/>:null)}{entries.map(e=>e.planetIds.filter(id=>positions[id]).map(id=>nodes[e.id]?<line key={`${e.id}-${id}`} className={selected===e.id?'selected':''} x1={nodes[e.id].x} y1={nodes[e.id].y} x2={positions[id].x} y2={positions[id].y}/>:null))}</g>
          {planets.map(p=>{const pos=positions[p.id];if(!pos)return null;const radius=planetRadius(p.entryCount);return <g key={p.id} data-planet={p.id} className={`cosmos-planet ${p.id===DWARF_ID?'dwarf-planet':''}`} transform={`translate(${pos.x} ${pos.y})`} role="button" tabIndex={0} aria-label={`${p.name}, notes ${p.entryCount}, show pages`} onClick={e=>{if(e.detail===0)focusPlanet(p.id)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ignoreClick.current=false;focusPlanet(p.id)}if(e.key.startsWith('Arrow')){e.preventDefault();const p2={...stateRef.current.positions[p.id]};if(e.key==='ArrowLeft')p2.x-=15;if(e.key==='ArrowRight')p2.x+=15;if(e.key==='ArrowUp')p2.y-=15;if(e.key==='ArrowDown')p2.y+=15;update({...stateRef.current,manual:true,positions:{...stateRef.current.positions,[p.id]:p2}})}}}><circle r={radius} fill={p.color}/><text textAnchor="middle" y={-1} fontSize={p.id===DWARF_ID?9:Math.max(12,Math.min(20,radius*.35))}>{p.name}</text><text textAnchor="middle" y={17} className="cosmos-count">{p.entryCount}</text></g>})}
          {entries.map(e=>{const pos=nodes[e.id];if(!pos)return null;const parent=planets.find(p=>e.planetIds.includes(p.id)),color=parent?.color??'#9da7b4',left=parent&&positions[parent.id]&&pos.x<positions[parent.id].x;return <g data-note={e.id} key={e.id} className={`cosmos-note ${selected===e.id?'selected':''}`} role="button" tabIndex={0} aria-label={`Note: ${title(e)}`} transform={`translate(${pos.x} ${pos.y})`} onClick={()=>showNode(e.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showNode(e.id)}}}><circle className="cosmos-hit" r={Math.max(10,16/camera.zoom)} fill="transparent"/><circle className="cosmos-dot" r={5.5} fill={color}/>{camera.zoom>=1.15&&<g transform={`translate(${left?-12-174/camera.zoom:12} -12) scale(${1/camera.zoom})`}><foreignObject width="174" height={camera.zoom>=1.9?90:30}><div className="cosmos-note-label"><strong>{title(e)}</strong>{camera.zoom>=1.9&&<p>{e.body.slice(0,110)}</p>}</div></foreignObject></g>}</g>})}
        </g>
      </svg>
      {!entries.length&&<div className="cosmos-no-notes">{state.planetIds.length?'No pages in these 모행성 yet.':'Choose 모행성 to display.'}<button onClick={()=>state.planetIds.length?open(''):setPanel('keywords')}>{state.planetIds.length?'Classify notes':'Choose 모행성'}</button></div>}
    </div>
    <div className="cosmos-bottom"><span>{planets.length} 모행성 · {entries.length} nodes</span><span className="cosmos-gesture">Scroll to zoom · drag to move</span><div><button aria-label="Zoom out" onClick={()=>update({...stateRef.current,camera:zoomAt(stateRef.current.camera,{x:0,y:0},camera.zoom/1.25)})}><ZoomOut size={17}/></button><output aria-label="Zoom level">{Math.round(camera.zoom*100)}%</output><button aria-label="Zoom in" onClick={()=>update({...stateRef.current,camera:zoomAt(stateRef.current.camera,{x:0,y:0},camera.zoom*1.25)})}><ZoomIn size={17}/></button><button aria-label="Fit to screen" title="Fit to screen" onClick={()=>fit()}><Focus size={17}/></button></div></div>
    </div></SplitWorkspace>
    {name!==null&&<div className="cosmos-save-backdrop" onKeyDown={e=>{if(e.key==='Escape')setName(null)}}><form className="cosmos-save" role="dialog" aria-modal="true" aria-label="Save view" onSubmit={e=>{e.preventDefault();saveView()}}><label htmlFor="view-name">View name</label><input id="view-name" autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={50} required/><div><button type="button" onClick={()=>setName(null)}>Cancel</button><button type="submit" disabled={!name.trim()}>Save</button></div></form></div>}
    {notice&&<div className="cosmos-notice" role="status">{notice}</div>}
  </section>;
}
