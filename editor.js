import{textDiff,textInputEdit,moveTextOffset}from'./text-diff.mjs';
const $=id=>document.getElementById(id),editor=$('editor');
let ink,file=null,original='',revision=0,busy=false,shared,doc,stopDoc,opening=0,inputRange,contextId;
const types=['text/*','application/json','application/javascript','application/xml','.txt','.md','.json','.js','.ts','.css','.html','.csv','.ink','.log','.yaml','.yml'];
const dirty=()=>editor.value!==original;
function message(text=''){$('status').textContent=text;}
function metadata(){
 const prefix=editor.value.slice(0,editor.selectionStart);$('position').textContent=`Ln ${prefix.split('\n').length}, Col ${prefix.length-prefix.lastIndexOf('\n')}`;
 $('words').textContent=(editor.value.trim()?editor.value.trim().split(/\s+/).length:0).toLocaleString()+' words · '+editor.value.length.toLocaleString()+' characters';
 $('dirty').hidden=!dirty();$('save').disabled=busy||!doc||!dirty()&&!!file;$('save-as').disabled=busy||!doc;
 $('filename').textContent=file?.source||file?.title||'Untitled.txt';
 const pending=doc?.status?.pending,offline=doc?.status?.status==='offline';
 $('saved').textContent=offline?'Draft saved locally':pending?'Syncing draft…':dirty()?'Shared draft':file?'Saved in Ink OS':'New shared document';
 $('lines').textContent=Array.from({length:Math.max(1,editor.value.split('\n').length)},(_,index)=>index+1).join('\n');
}
function render(text){if(editor.value!==text){const edit=textDiff(editor.value,text),start=moveTextOffset(editor.selectionStart,edit),end=moveTextOffset(editor.selectionEnd,edit),direction=editor.selectionDirection,top=editor.scrollTop;editor.value=text;editor.setSelectionRange(start,end,direction);editor.scrollTop=top;}metadata();}
function backup(){if(!doc)return;try{localStorage.setItem('ink-text-backup:'+ink.snapshot.namespace+':'+doc.key,JSON.stringify({text:editor.value,revision}));}catch{}}
function bind(next){stopDoc?.();const previous=doc;doc=next;stopDoc=next.subscribe(event=>{if(doc!==next)return;if(event.type==='change'&&!event.local)render(next.text);if(event.type==='status'&&event.error){backup();message(event.error);}metadata();});render(next.text);void previous?.close();}
const baseKey=id=>'/fileBases/'+id;
async function route(id){contextId=id||null;await ink.request('desktop.route',{route:{app:'text-editor',...(id?{id}:{})}});}
async function openFile(target,{updateRoute=true}={}){
 if(!target)return;const generation=++opening;busy=true;editor.readOnly=true;metadata();
 try{
  const result=await ink.files.readText(target.id);if(result.text.includes('\0'))throw Error('This looks like a binary file. Choose a text file.');
  if(!ink.snapshot.modules?.textSeedFile)throw Error('Reload Ink OS to enable shared file drafts.');
  const next=await ink.text.open('editor:file:'+target.id,{seedFile:target.id});if(generation!==opening){await next.close();return;}
  file=result.object;original=result.text;const saved=shared.get(baseKey(file.id));revision=next.text===original?file.revision:saved?.revision||next.source?.revision||file.revision;
  bind(next);editor.readOnly=false;if(updateRoute)await route(file.id);message(revision!==file.revision?'The saved file changed. Save As keeps your shared draft.':'');
  const oldKey='ink-text-draft:'+ink.snapshot.namespace+':'+file.id;let legacy;try{legacy=JSON.parse(localStorage.getItem(oldKey)||'null');}catch{}
  if(legacy?.text&&legacy.text!==original){$('recover').hidden=false;$('recover').onclick=()=>{void doc.replace(legacy.text);revision=legacy.revision;render(doc.text);$('recover').hidden=true;message('Recovered the draft from this browser.');};}
  editor.focus();
 }catch(error){if(generation===opening)message(error.message);}finally{if(generation===opening){busy=false;metadata();}}
}
async function fresh(recover=false){
 const generation=++opening;busy=true;editor.readOnly=true;metadata();
 try{const key='/draftKeys/'+ink.instance;let identity=recover?shared.get(key):null;if(!identity){identity=crypto.randomUUID();await shared.set(key,identity);}const next=await ink.text.open('editor:draft:'+ink.instance+':'+identity);if(generation!==opening){await next.close();return;}file=null;revision=0;original='';bind(next);editor.readOnly=false;await route();message();editor.focus();}
 catch(error){message(error.message);}finally{if(generation===opening){busy=false;metadata();}}
}
let refreshing=false,refreshAgain=false;
async function refreshFile(){
 if(refreshing){refreshAgain=true;return;}if(!file||busy)return;refreshing=true;const current=doc,id=file.id;
 try{const result=await ink.files.readText(id);if(doc!==current)return;const marker=shared.get(baseKey(id));if(result.object.revision===revision)return;
  if(marker?.revision===result.object.revision||current.text===original||current.text===result.text){if(current.text===original&&current.text!==result.text)await current.replace(result.text);file=result.object;original=result.text;revision=file.revision;render(current.text);message();}
  else message('The saved file changed. Save As keeps your shared draft.');
 }catch(error){if(doc===current)message(error.status===404?'This file was deleted. Save As keeps your shared draft.':error.message);}
 finally{refreshing=false;if(refreshAgain){refreshAgain=false;void refreshFile();}}
}
function saveAs(){$('save-name').value=file?.source||file?.title||'Untitled.txt';$('save-dialog').showModal();$('save-name').select();}
async function save(){
 if(!file){saveAs();return;}if(busy||!doc)return;busy=true;metadata();const current=doc,id=file.id;
 try{await current.flush();const sentText=current.text,saved=await ink.files.saveText(id,sentText,revision);await shared.set(baseKey(id),{revision:saved.revision});if(doc===current){file=saved;revision=saved.revision;original=sentText;message('Saved to Ink OS.');}}
 catch(error){message(error.status===409?'The saved file changed. Save As keeps your shared draft.':error.message);}
 finally{busy=false;metadata();void refreshFile();}
}
$('save-form').onsubmit=async event=>{
 event.preventDefault();if(busy||!doc)return;busy=true;metadata();const current=doc;
 try{const name=$('save-name').value.trim();if(!name)throw Error('Enter a file name');await current.flush();const sentText=current.text,saved=await ink.files.createText(name,sentText);if(doc!==current)return;const next=await ink.text.open('editor:file:'+saved.id,{seedFile:saved.id});if(doc!==current){await next.close();return;}const latest=current.text;file=saved;revision=saved.revision;original=sentText;await shared.set(baseKey(file.id),{revision});bind(next);if(latest!==sentText){void next.replace(latest);render(next.text);}await route(file.id);$('save-dialog').close();message('Saved to Ink OS.');}
 catch(error){message(error.message);}finally{busy=false;metadata();}
};
$('cancel-save').onclick=()=>$('save-dialog').close();$('new').onclick=()=>void fresh();$('save').onclick=()=>void save();$('save-as').onclick=saveAs;
$('open').onclick=async()=>{try{const files=await ink.files.pick({multiple:false});if(files[0])await openFile(files[0]);}catch(error){message(error.message);}};
$('upload').onclick=()=>$('file-input').click();$('file-input').onchange=async()=>{try{const files=await ink.files.upload($('file-input').files);if(files[0])await openFile(files[0]);}catch(error){message(error.message);}finally{$('file-input').value='';}};
editor.onbeforeinput=event=>{inputRange={before:editor.value,start:editor.selectionStart,end:editor.selectionEnd,type:event.inputType};};
editor.oninput=()=>{if(!doc||editor.readOnly)return;try{const input=inputRange;inputRange=null;const edit=input&&input.before===doc.text?textInputEdit(input.before,editor.value,input.start,input.end,input.type):null;const saved=edit?doc.splice(edit.index,edit.remove,edit.text):doc.replace(editor.value);void saved.catch(error=>{backup();message(error.message);});}catch(error){backup();message(error.message);}metadata();};
editor.onselect=metadata;editor.onkeyup=metadata;editor.onclick=metadata;editor.onscroll=()=>{$('lines').scrollTop=editor.scrollTop;};
$('wrap').onclick=()=>{const wrap=editor.wrap==='off';editor.wrap=wrap?'soft':'off';$('wrap').setAttribute('aria-pressed',String(wrap));};
function find(){const query=$('find-input').value;if(!query)return;const haystack=editor.value.toLowerCase(),index=haystack.indexOf(query.toLowerCase(),editor.selectionEnd),next=index>=0?index:haystack.indexOf(query.toLowerCase());if(next<0){$('find-result').textContent='No matches';return;}editor.focus();editor.setSelectionRange(next,next+query.length);const count=haystack.split(query.toLowerCase()).length-1;$('find-result').textContent=count+' match'+(count===1?'':'es');metadata();}
$('find').onclick=()=>{$('find-bar').hidden=false;$('find-input').focus();};$('close-find').onclick=()=>{$('find-bar').hidden=true;editor.focus();};$('find-next').onclick=find;$('find-input').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();find();}};
addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();if(event.shiftKey)saveAs();else void save();}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='f'){event.preventDefault();event.stopImmediatePropagation();$('find').click();}if(event.key==='Tab'&&event.target===editor&&!editor.readOnly){event.preventDefault();inputRange=null;editor.setRangeText('  ',editor.selectionStart,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input'));}},{capture:true});
addEventListener('pagehide',backup);
try{
 editor.readOnly=true;ink=await Ink.connect();await ink.request('desktop.features',{inlineRoute:true});shared=await ink.state.open();
 await ink.files.acceptDrops(types,files=>void openFile(files[0])).ready;
 ink.on('context',event=>{if(!Object.hasOwn(event,'route'))return;const id=event.route?.id||null;if(id===contextId)return;contextId=id;if(id&&id!==ink.snapshot.namespace)void openFile({id},{updateRoute:false});else void fresh(true);});
 ink.on('world.delta',event=>{if(file&&(event.objects?.some(object=>object.id===file.id)||event.removed?.includes(file.id)))void refreshFile();});
 shared.subscribe(event=>{if(event.type!=='change')return;if(file)void refreshFile();else if(doc&&shared.get('/draftKeys/'+ink.instance)&&!doc.key.endsWith(':'+shared.get('/draftKeys/'+ink.instance)))void fresh(true);});
 contextId=ink.route.id||null;if(contextId&&contextId!==ink.snapshot.namespace)await openFile({id:contextId},{updateRoute:false});else await fresh(true);ink.ready();metadata();
}catch(error){message(error.message);for(const id of ['new','open','upload','save','save-as'])$(id).disabled=true;}
