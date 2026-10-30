import {CronCapability, HTTPClient, EVMClient, Runner, handler, consensusIdenticalAggregation, getNetwork, encodeCallMsg, LAST_FINALIZED_BLOCK_NUMBER, protoBigIntToBigint, prepareReportRequest, type NodeRuntime, type Runtime} from '@chainlink/cre-sdk'
import {sha256, concatHex, numberToHex, toHex, encodeFunctionData, decodeFunctionResult, encodeAbiParameters, parseAbiParameters, bytesToHex, zeroAddress} from 'viem'

type Config={schedule:string;datasetUrl:string;expectedContentHash:string;expectedRoot:string;expectedEpoch:number;chainId:string;datasetId:string;registryAddress:string;receiverAddress:string;expectedPreviousRoot?:string;mode?:'audit-current'|'publish-next'}
type Dataset={schema:string;chainId:string;datasetId:string;epoch:number;addresses:string[];provenance:string}
const registryAbi=[
 {type:'function',name:'root',stateMutability:'view',inputs:[],outputs:[{type:'bytes32'}]},
 {type:'function',name:'epoch',stateMutability:'view',inputs:[],outputs:[{type:'uint256'}]}
 ,{type:'function',name:'datasetId',stateMutability:'view',inputs:[],outputs:[{type:'bytes32'}]}
 ,{type:'function',name:'contentHash',stateMutability:'view',inputs:[],outputs:[{type:'bytes32'}]}
 ,{type:'function',name:'count',stateMutability:'view',inputs:[],outputs:[{type:'uint256'}]}
] as const
const address=(a:string)=>{if(!/^0x[0-9a-fA-F]{40}$/.test(a))throw Error('bad address');return a.toLowerCase() as `0x${string}`}
const word=(n:bigint)=>numberToHex(n,{size:32})
const leaf=(chainId:bigint,id:`0x${string}`,epoch:bigint,a:`0x${string}`)=>sha256(concatHex(['0x00',word(chainId),id,word(epoch),a]))
const rootOf=(d:Dataset)=>{
 if(d.schema!=='listproof-addresses-v1'||!Number.isSafeInteger(d.epoch)||d.epoch<1||!Array.isArray(d.addresses)||!d.addresses.length)throw Error('schema')
 const a=d.addresses.map(address).sort();if(a.some((x,i)=>i>0&&x===a[i-1]))throw Error('duplicate')
 let level=a.map(x=>leaf(BigInt(d.chainId),sha256(toHex(d.datasetId)),BigInt(d.epoch),x))
 while(level.length>1){const next:typeof level=[];for(let i=0;i<level.length;i+=2)next.push(i+1<level.length?sha256(concatHex(['0x01',level[i],level[i+1]])):level[i]);level=next}
 return {root:level[0],count:a.length}
}
const fetchDataset=(node:NodeRuntime<Config>):{body:string;contentHash:string}=>{
 const response=new HTTPClient().sendRequest(node,{url:node.config.datasetUrl,method:'GET'}).result()
 if(response.statusCode!==200)throw Error(`dataset HTTP ${response.statusCode}`)
 return {body:new TextDecoder().decode(response.body),contentHash:sha256(response.body)}
}
const onCron=(runtime:Runtime<Config>)=>{
 const c=runtime.config
 if(c.receiverAddress&&!c.registryAddress)throw Error('registry required for receiver')
 if(c.mode==='audit-current'&&c.receiverAddress)throw Error('audit mode must not configure receiver')
 if(c.chainId!=='11155111')throw Error('Sepolia chain ID required')
 const fetched=runtime.runInNodeMode(fetchDataset,consensusIdenticalAggregation<{body:string;contentHash:string}>())().result()
 if(fetched.contentHash.toLowerCase()!==c.expectedContentHash.toLowerCase())throw Error('content hash mismatch')
 const data=JSON.parse(fetched.body) as Dataset
 if(data.chainId!==c.chainId||data.datasetId!==c.datasetId||data.epoch!==c.expectedEpoch)throw Error('version or dataset mismatch')
 const {root,count}=rootOf(data)
 if(root.toLowerCase()!==c.expectedRoot.toLowerCase())throw Error('root mismatch')
 const network=getNetwork({chainFamily:'evm',chainSelectorName:'ethereum-testnet-sepolia'});if(!network)throw Error('network')
 const client=new EVMClient(network.chainSelector.selector)
 const header=client.headerByNumber(runtime,{}).result()
 if(!header.header?.blockNumber)throw Error('missing Sepolia block number')
 const observedBlock=protoBigIntToBigint(header.header.blockNumber).toString()
 let registryObservation='not configured; no onchain read'
 if(c.registryAddress){
  const contractAddress=address(c.registryAddress)
  const epochReply=client.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:contractAddress,data:encodeFunctionData({abi:registryAbi,functionName:'epoch'})}),blockNumber:LAST_FINALIZED_BLOCK_NUMBER}).result()
  const rootReply=client.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:contractAddress,data:encodeFunctionData({abi:registryAbi,functionName:'root'})}),blockNumber:LAST_FINALIZED_BLOCK_NUMBER}).result()
  const currentEpoch=decodeFunctionResult({abi:registryAbi,functionName:'epoch',data:bytesToHex(epochReply.data)})
  const currentRoot=decodeFunctionResult({abi:registryAbi,functionName:'root',data:bytesToHex(rootReply.data)})
  if(c.mode==='audit-current'){
   if(BigInt(c.expectedEpoch)!==currentEpoch)throw Error('registry current epoch mismatch')
   if(currentRoot.toLowerCase()!==root.toLowerCase())throw Error('registry current root mismatch')
  }else{
   if(BigInt(c.expectedEpoch)!==currentEpoch+1n)throw Error('registry epoch mismatch')
   if(!c.expectedPreviousRoot||!/^0x[0-9a-fA-F]{64}$/.test(c.expectedPreviousRoot)||currentRoot.toLowerCase()!==c.expectedPreviousRoot.toLowerCase())throw Error('registry previous root mismatch')
  }
  const idReply=client.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:contractAddress,data:encodeFunctionData({abi:registryAbi,functionName:'datasetId'})}),blockNumber:LAST_FINALIZED_BLOCK_NUMBER}).result()
  const currentId=decodeFunctionResult({abi:registryAbi,functionName:'datasetId',data:bytesToHex(idReply.data)})
  if(currentId.toLowerCase()!==sha256(toHex(c.datasetId)).toLowerCase())throw Error('registry dataset mismatch')
  if(c.mode==='audit-current'){
   const hashReply=client.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:contractAddress,data:encodeFunctionData({abi:registryAbi,functionName:'contentHash'})}),blockNumber:LAST_FINALIZED_BLOCK_NUMBER}).result()
   const countReply=client.callContract(runtime,{call:encodeCallMsg({from:zeroAddress,to:contractAddress,data:encodeFunctionData({abi:registryAbi,functionName:'count'})}),blockNumber:LAST_FINALIZED_BLOCK_NUMBER}).result()
   const currentHash=decodeFunctionResult({abi:registryAbi,functionName:'contentHash',data:bytesToHex(hashReply.data)})
   const currentCount=decodeFunctionResult({abi:registryAbi,functionName:'count',data:bytesToHex(countReply.data)})
   if(currentHash.toLowerCase()!==fetched.contentHash.toLowerCase()||currentCount!==BigInt(count))throw Error('registry current content mismatch')
   registryObservation=`epoch=${currentEpoch}, root=${currentRoot}, contentHash=${currentHash}, count=${currentCount}`
  }else{
   registryObservation=`epoch=${currentEpoch}, root=${currentRoot}`
  }
 }
 const payload=encodeAbiParameters(parseAbiParameters('uint256 chainId, bytes32 datasetId, uint256 epoch, bytes32 root, bytes32 contentHash, uint256 count'),[BigInt(c.chainId),sha256(toHex(c.datasetId)),BigInt(data.epoch),root as `0x${string}`,fetched.contentHash as `0x${string}`,BigInt(count)])
 const signed=runtime.report(prepareReportRequest(payload)).result()
 let publishStatus=c.mode==='audit-current'?'signed audit report prepared; read-only registry check; no transaction sent':'signed report prepared; no receiver configured, no transaction sent'
 if(c.receiverAddress){
  const write=client.writeReport(runtime,{receiver:address(c.receiverAddress),report:signed,gasConfig:{gasLimit:'500000'}}).result()
  publishStatus=`CRE write result: txStatus=${write.txStatus}; txHash=${write.txHash?.length?bytesToHex(write.txHash):'none'}; receipt not verified by workflow`
 }
 const report={chainId:c.chainId,datasetId:c.datasetId,epoch:data.epoch,root,count,contentHash:fetched.contentHash,observedSepoliaBlock:observedBlock,registryObservation,publishStatus}
 runtime.log(JSON.stringify(report));return report
}
const initWorkflow=(config:Config)=>[handler(new CronCapability().trigger({schedule:config.schedule}),onCron)]
export async function main(){const runner=await Runner.newRunner<Config>();await runner.run(initWorkflow)}
