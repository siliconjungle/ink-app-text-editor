// Keep previewing independent of the editor's startup and side effects.
if(new URLSearchParams(location.search).get('mode')==='preview'){const {startPreview}=await import('./quick-look.mjs');await startPreview();}else{await import("./editor.js");}
