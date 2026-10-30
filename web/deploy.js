const E=window.ethers;
const $=id=>document.getElementById(id);
const EXPECTED='0x765fb7e6a0BdDDc29f57eeCE34AEda0Fb318805d';
const CHAIN=11155111n;
let provider,signer,account,config,stored={registry:null,gate:null},prepared=null,publicationPrepared=null,busy=false,publicationInFlight=false;
const show=(id,message)=>{$(id).textContent=message;};
const showVerified=(id,record)=>{
 const target=$(id);target.replaceChildren();
 const info=document.createElement('div');info.textContent=`VERIFIED ${record.contract}: ${record.address}\nBlock: ${record.blockNumber}\nEvidence saved locally.\n`;
 const tx=document.createElement('a');tx.href=record.explorerTx;tx.target='_blank';tx.rel='noopener noreferrer';tx.textContent='View transaction on Sepolia Etherscan';
 const address=document.createElement('a');address.href=record.explorerAddress;address.target='_blank';address.rel='noopener noreferrer';address.textContent='View contract on Sepolia Etherscan';
 target.append(info,tx,document.createElement('br'),address);
};
const fail=e=>e?.shortMessage||e?.message||String(e);
const request=async(path,body)=>{const response=await fetch(path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;};
function resetPreparation(){prepared=null;publicationPrepared=null;$('deployRegistry').disabled=true;$('deployGate').disabled=true;$('publishRoot').disabled=true;}
async function walletIdentity(){
 if(!provider)throw Error('Connect MetaMask first');
 const network=await provider.getNetwork();
 const rawChain=await window.ethereum.request({method:'eth_chainId'});
 const current=E.getAddress(await signer.getAddress());
 if(network.chainId!==CHAIN||BigInt(rawChain)!==CHAIN)throw Error(`Wrong chain ${rawChain}; select Ethereum Sepolia (11155111) in MetaMask`);
 if(current.toLowerCase()!==EXPECTED.toLowerCase())throw Error(`Wrong account ${current}; select ${EXPECTED}`);
 return current;
}
async function refreshEvidence(){
 try{stored=await request('/api/evidence');}
 catch(error){stored={registry:null,gate:null};show('registryResult',`Saved evidence could not be reverified: ${fail(error)}`);}
 if(stored.registry)showVerified('registryResult',stored.registry);
 if(stored.gate)showVerified('gateResult',stored.gate);
 $('prepareRegistry').disabled=!account||!!stored.registry||busy;
 $('prepareGate').disabled=!account||!stored.registry||!!stored.gate||busy;
 $('recoverKind').value=stored.registry?'ListProofGate':'ListProofRegistry';
}
async function connect(){
 if(!E)throw Error('ethers.js is unavailable. Run npm.cmd install in the deploy-ui directory, then reload.');
 if(!window.ethereum?.isMetaMask)throw Error('MetaMask injected provider not found');
 const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
 if(!accounts?.length)throw Error('MetaMask did not provide an account');
 provider=new E.BrowserProvider(window.ethereum);
 signer=await provider.getSigner();
 account=await walletIdentity();
 resetPreparation();
 show('wallet',`Connected account: ${account}\nChain ID: 11155111 (Ethereum Sepolia)`);
 await refreshEvidence();
 await refreshPublication();
}
async function prepare(kind){
 if(busy)throw Error('Another wallet action is in progress');
 if(!config)config=await request('/api/config');
 account=await walletIdentity();
 const registry=kind==='ListProofRegistry';
 if(registry&&stored.registry)throw Error('Registry is already saved; this page prevents a second deployment');
 if(!registry&&!stored.registry)throw Error('A verified Registry receipt is required');
 if(!registry&&stored.gate)throw Error('Gate is already saved');
 const artifact=await request(`/api/artifact/${kind}`);
 if(artifact.compiler!=='0.8.24+commit.e11b9ed9'||artifact.optimizerRuns!==200||artifact.viaIR!==true)throw Error('Compiler settings mismatch');
 const datasetId=E.sha256(E.toUtf8Bytes('listproof-synthetic-demo'));
 if(datasetId.toLowerCase()!==config.datasetId.toLowerCase())throw Error('Dataset ID mismatch');
 const args=registry?[datasetId,account]:[stored.registry.address];
 const factory=new E.ContractFactory(artifact.abi,artifact.bytecode,signer);
 const tx=await factory.getDeployTransaction(...args);
 if(tx.value&&BigInt(tx.value)!==0n)throw Error('Unexpected nonzero transaction value');
 const gas=await provider.estimateGas({...tx,from:account,value:0n});
 const fee=await provider.getFeeData();
 const unit=fee.maxFeePerGas??fee.gasPrice;
 if(!unit)throw Error('Fee estimate unavailable');
 const gasLimit=gas+(gas/5n)+1n;
 const cost=gasLimit*unit;
 const balance=await provider.getBalance(account);
 if(balance<cost)throw Error(`Insufficient Sepolia ETH for estimated maximum gas cost ${E.formatEther(cost)} ETH`);
 prepared={kind,args,artifact,tx,gas,gasLimit,unit,cost,account,created:Date.now()};
 const review=`Connected account: ${account}\nChain ID: 11155111\nContract: ${kind}\nConstructor arguments: ${JSON.stringify(args)}\nEstimated gas: ${gas}\nGas limit (20% headroom): ${gasLimit}\nEstimated maximum Sepolia ETH cost: ${E.formatEther(cost)} ETH\nExpected transaction value: 0 ETH\nCompiler: solc 0.8.24, optimizer 200, viaIR`;
 show(registry?'registryReview':'gateReview',review);
 $('deployRegistry').disabled=!registry;
 $('deployGate').disabled=registry;
}
async function deploy(kind){
 if(busy||!prepared||prepared.kind!==kind)throw Error('Review and estimate this contract first');
 if(Date.now()-prepared.created>120000){resetPreparation();throw Error('Estimate expired; prepare again');}
 account=await walletIdentity();
 if(account.toLowerCase()!==prepared.account.toLowerCase()){resetPreparation();throw Error('Wallet changed; prepare again');}
 const resultId=kind==='ListProofRegistry'?'registryResult':'gateResult';
 const message=`Send a Sepolia deployment transaction from ${account}?\n\n${kind}\nConstructor: ${JSON.stringify(prepared.args)}\nEstimated gas: ${prepared.gas}\nGas limit: ${prepared.gasLimit}\nMaximum estimated network cost: ${E.formatEther(prepared.cost)} ETH\nTransaction value: 0 ETH\n\nMetaMask will ask you to sign. This action cannot be undone.`;
 if(!window.confirm(message))return;
 if((await walletIdentity()).toLowerCase()!==prepared.account.toLowerCase()){resetPreparation();throw Error('Wallet changed after confirmation; prepare again');}
 busy=true;$('deployRegistry').disabled=true;$('deployGate').disabled=true;
 try{
  const tx=await signer.sendTransaction({...prepared.tx,gasLimit:prepared.gasLimit,value:0n});
  show(resultId,`Submitted: ${tx.hash}\nWaiting for Sepolia receipt…\nhttps://sepolia.etherscan.io/tx/${tx.hash}`);
  const receipt=await tx.wait();
  if(receipt?.status!==1||!receipt.contractAddress)throw Error(`Deployment was not successful. Inspect ${tx.hash}`);
  const code=await provider.getCode(receipt.contractAddress);
  if(!code||code==='0x')throw Error('Receipt exists but deployed bytecode is absent');
  show(resultId,`Mined at ${receipt.contractAddress}. Server is independently verifying and saving evidence…`);
  const saved=await request('/api/evidence',{contract:kind,transactionHash:tx.hash});
  showVerified(resultId,saved);
  resetPreparation();await refreshEvidence();
 }catch(error){show(resultId,`Deployment/evidence check: ${fail(error)}\nIf MetaMask submitted a transaction, use the recovery form with its actual hash.`);}
 finally{busy=false;prepared=null;await refreshEvidence();}
}
async function recover(){
 const kind=$('recoverKind').value,hash=$('recoverHash').value.trim();
 if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Enter a full transaction hash');
 show('recoverResult','Checking Sepolia receipt, creation input, code and contract state…');
 const saved=await request('/api/evidence',{contract:kind,transactionHash:hash});
  showVerified('recoverResult',saved);
  await refreshEvidence();
}
function action(button,fn,target){$(button).onclick=async()=>{try{await fn();}catch(error){show(target,`ERROR: ${fail(error)}`);}};}
action('connect',connect,'wallet');
action('prepareRegistry',()=>prepare('ListProofRegistry'),'registryReview');
action('prepareGate',()=>prepare('ListProofGate'),'gateReview');
action('deployRegistry',()=>deploy('ListProofRegistry'),'registryResult');
action('deployGate',()=>deploy('ListProofGate'),'gateResult');
action('recover',recover,'recoverResult');
async function refreshPublication(){
 publicationPrepared=null;$('publishRoot').disabled=true;$('preparePublication').disabled=true;
 try{
  const result=await request('/api/publication/epoch-1');
  const s=result.state,c=result.commitment;
  show('publicationState',`Registry: ${s.registryAddress}\nChain ID: ${s.chainId}; block: ${s.blockNumber}\nPublisher: ${s.publisher}\nDataset ID: ${s.datasetId}\nCurrent epoch: ${s.epoch}\nCurrent root: ${s.root}\nCurrent content hash: ${s.contentHash}\nCurrent count: ${s.count}\nGate: ${s.gateAddress}; Gate registry: ${s.gateRegistry}\nRegistry/Gate bytecode: ${s.registryCodeMatches&&s.gateCodeMatches?'MATCH':'MISMATCH'}\nEpoch-1 root to publish: ${c.root}\nEpoch-1 content hash: ${c.contentHash}\nAddresses: ${c.count}\n${result.ready?'READY FOR ESTIMATE':`BLOCKED: ${result.reason}`}`);
  $('preparePublication').disabled=!result.ready||!account||busy;
  return result;
 }catch(error){show('publicationState',`On-chain verification unavailable: ${fail(error)}\nNo publication can be prepared.`);return null;}
}
async function preparePublication(){
 if(busy)throw Error('Another wallet action is in progress');
 account=await walletIdentity();
 const result=await refreshPublication();
 if(!result?.ready)throw Error(result?.reason||'On-chain state unavailable');
 const s=result.state,c=result.commitment;
 const registryArtifact=await request('/api/artifact/ListProofRegistry');
 const gateArtifact=await request('/api/artifact/ListProofGate');
 const registryCode=await provider.getCode(s.registryAddress),gateCode=await provider.getCode(s.gateAddress);
 if(registryCode==='0x'||gateCode==='0x'||!s.registryCodeMatches||!s.gateCodeMatches)throw Error('Registry or Gate bytecode mismatch');
 const registry=new E.Contract(s.registryAddress,registryArtifact.abi,signer);
 const gate=new E.Contract(s.gateAddress,gateArtifact.abi,provider);
 const [publisher,id,epoch,root,hash,count,gateRegistry]=await Promise.all([registry.publisher(),registry.datasetId(),registry.epoch(),registry.root(),registry.contentHash(),registry.count(),gate.registry()]);
 if(publisher.toLowerCase()!==EXPECTED.toLowerCase()||id.toLowerCase()!==c.datasetKey.toLowerCase()||epoch!==0n||root.toLowerCase()!==s.root.toLowerCase()||hash.toLowerCase()!==s.contentHash.toLowerCase()||count!==0n||gateRegistry.toLowerCase()!==s.registryAddress.toLowerCase())throw Error('MetaMask RPC disagrees with independently checked Sepolia state');
 const args=[1n,c.root,c.contentHash,BigInt(c.count)];
 const tx=await registry.publish.populateTransaction(...args);
 if(tx.value&&BigInt(tx.value)!==0n)throw Error('Unexpected transaction value');
 if(tx.to?.toLowerCase()!==s.registryAddress.toLowerCase())throw Error('Publish transaction targets another contract');
 const gas=await provider.estimateGas({...tx,from:account,value:0n});
 const fee=await provider.getFeeData(),unit=fee.maxFeePerGas??fee.gasPrice;
 if(!unit)throw Error('Fee estimate unavailable');
 const gasLimit=gas+gas/5n+1n,cost=gasLimit*unit;
 if((await provider.getBalance(account))<cost)throw Error(`Insufficient Sepolia ETH; estimated maximum fee ${E.formatEther(cost)} ETH`);
 publicationPrepared={account,args,tx,gas,gasLimit,cost,commitment:c,state:s,created:Date.now()};
 show('publicationReview',`Connected account: ${account}\nChain ID: 11155111\nRegistry: ${s.registryAddress}\nDataset ID: ${c.datasetKey}\nEpoch: 1\nMerkle root: ${c.root}\nContent hash: ${c.contentHash}\nDataset address count: ${c.count}\nCurrent on-chain epoch/root/hash/count: ${s.epoch} / ${s.root} / ${s.contentHash} / ${s.count}\nGas estimate: ${gas}\nGas limit (20% headroom): ${gasLimit}\nEstimated maximum Sepolia ETH fee: ${E.formatEther(cost)} ETH\nTransaction value: 0 ETH`);
 $('publishRoot').disabled=false;
}
function showPublicationReceipt(record){
 const target=$('publicationResult');target.replaceChildren();
 const info=document.createElement('div');info.textContent=`VERIFIED epoch ${record.epoch} at ${record.contractAddress}\nRoot: ${record.root}\nContent hash: ${record.contentHash}\nBlock: ${record.blockNumber}\nEvidence saved locally.\n`;
 const link=document.createElement('a');link.href=record.explorerTx;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View root publication on Sepolia Etherscan';
 target.append(info,link);
}
async function publishRootOnce(){
 const p=publicationPrepared;
 if(busy||!p)throw Error('Estimate and review epoch 1 first');
 if(Date.now()-p.created>120000){publicationPrepared=null;$('publishRoot').disabled=true;throw Error('Estimate expired; prepare again');}
 if((await walletIdentity()).toLowerCase()!==p.account.toLowerCase())throw Error('Wallet changed; prepare again');
 const fresh=await refreshPublication();
 if(!fresh?.ready||fresh.state.epoch!==p.state.epoch||fresh.state.root.toLowerCase()!==p.state.root.toLowerCase()||fresh.commitment.root.toLowerCase()!==p.commitment.root.toLowerCase()||fresh.commitment.contentHash.toLowerCase()!==p.commitment.contentHash.toLowerCase())throw Error('On-chain state or commitment changed; prepare again');
 const message=`Publish synthetic epoch 1 to ${p.state.registryAddress}?\n\nPublisher: ${p.account}\nDataset ID: ${p.commitment.datasetKey}\nRoot: ${p.commitment.root}\nContent hash: ${p.commitment.contentHash}\nCount: ${p.commitment.count}\nEstimated gas: ${p.gas}\nGas limit: ${p.gasLimit}\nEstimated maximum fee: ${E.formatEther(p.cost)} Sepolia ETH\nTransaction value: 0 ETH\n\nMetaMask will request a separate signature.`;
 if(!window.confirm(message))return;
 if((await walletIdentity()).toLowerCase()!==p.account.toLowerCase())throw Error('Wallet changed after confirmation');
 const finalState=await request('/api/publication/epoch-1');
 if(!finalState.ready||finalState.commitment.root.toLowerCase()!==p.commitment.root.toLowerCase()||finalState.commitment.contentHash.toLowerCase()!==p.commitment.contentHash.toLowerCase())throw Error(finalState.reason||'Registry or commitment changed before signing');
 busy=true;$('publishRoot').disabled=true;
 try{
  const tx=await signer.sendTransaction({...p.tx,gasLimit:p.gasLimit,value:0n});
  show('publicationResult',`Submitted ${tx.hash}\nWaiting for Sepolia receipt...\nhttps://sepolia.etherscan.io/tx/${tx.hash}`);
  const receipt=await tx.wait();if(receipt?.status!==1)throw Error(`Publication failed; inspect ${tx.hash}`);
  const registry=new E.Contract(p.state.registryAddress,(await request('/api/artifact/ListProofRegistry')).abi,provider);
  const [epoch,root,hash,count]=await Promise.all([registry.epoch(),registry.root(),registry.contentHash(),registry.count()]);
  if(epoch!==1n||root.toLowerCase()!==p.commitment.root.toLowerCase()||hash.toLowerCase()!==p.commitment.contentHash.toLowerCase()||count!==BigInt(p.commitment.count))throw Error('Mined transaction did not produce the expected registry state');
  const verified=await request('/api/publication/epoch-1',{transactionHash:tx.hash});
  showPublicationReceipt(verified);
 }catch(error){show('publicationResult',`Publication/evidence check: ${fail(error)}\nIf MetaMask submitted a transaction, use the publication recovery field with its actual hash.`);}
 finally{busy=false;publicationPrepared=null;await refreshPublication();}
}
async function publishRoot(){
 if(publicationInFlight)throw Error('Publication confirmation already in progress');
 publicationInFlight=true;
 try{return await publishRootOnce();}finally{publicationInFlight=false;}
}
async function recoverPublication(){
 const hash=$('publicationHash').value.trim();if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Enter a full publication transaction hash');
 show('publicationResult','Verifying Sepolia receipt, exact calldata, event and current registry state...');
 const verified=await request('/api/publication/epoch-1',{transactionHash:hash});showPublicationReceipt(verified);await refreshPublication();
}
action('refreshPublication',refreshPublication,'publicationState');
action('preparePublication',preparePublication,'publicationReview');
action('publishRoot',publishRoot,'publicationResult');
action('recoverPublication',recoverPublication,'publicationResult');
window.ethereum?.on?.('accountsChanged',()=>{account=null;resetPreparation();show('wallet','Wallet account changed. Reconnect and review again.');$('prepareRegistry').disabled=true;$('prepareGate').disabled=true;});
window.ethereum?.on?.('chainChanged',()=>{account=null;resetPreparation();show('wallet','Network changed. Reconnect and review again.');$('prepareRegistry').disabled=true;$('prepareGate').disabled=true;});
request('/api/config').then(value=>{config=value;if(!E)show('wallet','ethers.js missing. Run npm.cmd install in deploy-ui from ordinary PowerShell, then reload.');}).catch(error=>show('wallet',`Local server error: ${fail(error)}`));
