(async ()=>{
  try{
    await import('../js/mensajeria.js');
    console.log('IMPORT OK');
  }catch(e){
    console.error('IMPORT ERROR');
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
