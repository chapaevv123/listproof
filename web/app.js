const address = document.querySelector('#address');
const epoch = document.querySelector('#epoch');
const output = document.querySelector('#result');
const verifyButton = document.querySelector('#verify');
let lastReceipt = null;

const download = document.createElement('button');
download.textContent = 'Download proof receipt';
download.disabled = true;
download.style.marginLeft = '8px';
verifyButton.after(download);

async function jsonRequest(path, body) {
  const response = await fetch(path, body ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)} : undefined);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
async function refresh() {
  const states = await jsonRequest('/api/state');
  const state = states.find(item => item.epoch === Number(epoch.value));
  if (!state) throw new Error('Dataset epoch unavailable');
  document.querySelector('#epochValue').textContent = `Epoch ${state.epoch}`;
  document.querySelector('#root').textContent = state.root;
  const dataset = await jsonRequest(`/dataset/${state.epoch}`);
  document.querySelector('#datasetAddresses').textContent = dataset.addresses.map((item,index) => `${index}  ${item}`).join('\n');
}
async function run(mode = 'manual') {
  if (mode === 'listed') address.value = '0x0000000000000000000000000000000000000005';
  else if (mode !== 'manual') address.value = '0x0000000000000000000000000000000000000006';
  if (mode === 'stale') epoch.value = '1';
  lastReceipt = null; download.disabled = true; verifyButton.disabled = true;
  output.textContent = 'Generating proof and checking commitment…';
  try {
    await refresh();
    const generated = await jsonRequest('/api/proof', {address:address.value, epoch:Number(epoch.value), mode});
    if (generated.status === 'listed') {output.textContent = 'REJECTED · Address is present in the committed synthetic dataset.'; return;}
    const independently = await jsonRequest('/api/verify', {proof:generated.proof,againstEpoch:generated.checkedAgainst.epoch});
    if (independently.verified !== (generated.status === 'verified')) throw new Error('Verifier disagreement');
    lastReceipt = {...generated.receipt,independentVerification:independently};
    download.disabled = false;
    output.textContent = `${independently.verified ? 'VERIFIED' : 'REJECTED'} · ${independently.verified ? 'Address absent from this committed dataset.' : 'Proof failed against the selected commitment.'}\n\n${JSON.stringify(lastReceipt,null,2)}`;
  } catch (error) {
    output.textContent = `ERROR · ${error.message}`;
  } finally {
    verifyButton.disabled = false;
  }
}
download.onclick = () => {
  if (!lastReceipt) return;
  const blob = new Blob([JSON.stringify(lastReceipt,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `listproof-epoch-${lastReceipt.commitment.epoch}-receipt.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
};
epoch.onchange = () => refresh().catch(error => {output.textContent = `ERROR · ${error.message}`;});
verifyButton.onclick = () => run('manual');
document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => run(button.dataset.mode));
refresh().catch(error => {output.textContent = `ERROR · ${error.message}`;});
async function showSepoliaEvidence() {
  const target=document.querySelector('#sepoliaEvidence');
  try {
    const evidence=await jsonRequest('/api/sepolia');
    target.replaceChildren();
    const line=value=>{const div=document.createElement('div');div.textContent=value;target.append(div);};
    const link=(label,url)=>{const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.color='#9af0bd';target.append(a,document.createElement('br'));};
    line(`Synthetic dataset · epoch ${evidence.epoch} · ${evidence.count} addresses`);
    line(`Committed root: ${evidence.root}`);
    link(`Registry ${evidence.registry.address}`,evidence.registry.explorer);
    link(`Gate ${evidence.gate.address}`,evidence.gate.explorer);
    link(`RootUpdated transaction · block ${evidence.rootPublication.blockNumber}`,evidence.rootPublication.explorerTx);
    if(evidence.proofCheck.status==='verified-read-only'){
      line(`Gate eth_call checks at Sepolia block ${evidence.proofCheck.blockNumber} (no transaction):`);
      for(const result of evidence.proofCheck.results)line(`${result.passed?'PASS':'FAIL'} · ${result.name} · ${result.expected}`);
    }else line('Gate eth_call proof checks: pending; no on-chain proof result claimed.');
    line('CRE: official local simulation read the Sepolia Registry; no receiver update on-chain.');
  }catch(error){target.textContent=`Sepolia evidence unavailable: ${error.message}`;}
}
showSepoliaEvidence();
