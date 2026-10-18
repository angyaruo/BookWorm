import { setup } from '/dist/frontend.js';
let receive;
const jobs = new Map();
window.bookwormTest = { messages:[], manual:false, receive:payload => receive(payload) };
window.bookwormTest.dispose = setup({
  dom:{addStyle(css) { const style=document.createElement('style'); style.textContent=css; document.head.append(style); return () => style.remove(); }},
  onBackendMessage(callback) { receive=callback; return () => { receive=() => {}; }; },
  async sendToBackend(payload) {
    window.bookwormTest.messages.push(payload);
    const {type,requestId} = payload;
    if (type === 'bookworm:cancel') { clearInterval(jobs.get(requestId)); jobs.delete(requestId); return; }
    if (type === 'bookworm:get_connections') { receive({type:'bookworm:connections',connections:[{id:'preview',name:'Preview model (simulated)'}]}); return; }
    if (window.bookwormTest.manual) return;
    if (type === 'bookworm:lookup_word') {
      const response = await fetch(`/lookup?q=${encodeURIComponent(payload.query)}`);
      if (!response.ok) throw new Error('Lookup failed');
      receive({type:'bookworm:result',requestId,lookup:await response.json()});
    } else if (type === 'bookworm:consult') {
      const text = '# A word worth keeping\n\n**Obsolete** — no longer in use; replaced by something newer.\n\n> The obsolete map still showed a road to her childhood home.\n\n## A different shade\n\n**Archaic** suggests an earlier period, especially in language or style.\n\n`Old-fashioned` can feel warmer and less final.\n\nThis is a simulated preview answer, not a model response.';
      let offset = 0;
      jobs.set(requestId,setInterval(() => {
        receive({type:'bookworm:result_chunk',requestId,text:text.slice(offset,offset+18)}); offset+=18;
        if (offset >= text.length) { clearInterval(jobs.get(requestId)); jobs.delete(requestId); receive({type:'bookworm:result',requestId,answer:text}); }
      },35));
    }
  },
});
