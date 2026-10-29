export const giftRules = [
  {min:1,tier:'bloom',label:'Jardim'}, {min:10,tier:'neon',label:'Neon'},
  {min:100,tier:'royal',label:'Realeza'}, {min:500,tier:'cosmic',label:'Galáxia'},
  {min:1000,tier:'phoenix',label:'Fênix'}, {min:5000,tier:'imperial',label:'Imperial'},
  {min:10000,tier:'celestial',label:'Celestial'}
];
export function username(value) {
  const name=String(value||'').trim().replace(/^@/,'');
  if(!/^[a-zA-Z0-9_.]{2,24}$/.test(name)) throw new Error('Digite apenas seu @ do TikTok, sem o link.');
  return name;
}
export function tierFor(cost) {return [...giftRules].reverse().find(r=>cost>=r.min)?.tier||'bloom'}
const number=value=>Math.max(0,Math.min(Number(value)||0,Number.MAX_SAFE_INTEGER));
export function normalize(type,data={}) {
  const user=data.user||{};
  const candidate=[...(user.avatarLarge?.urlList||[]),...(user.avatarMedium?.urlList||[]),data.profilePictureUrl,...(user.avatarThumb?.urlList||[])].find(url=>typeof url==='string'&&url.startsWith('https://')); 
  const avatar=typeof candidate==='string'&&candidate.startsWith('https://')?candidate:null;
  const name=String(user.uniqueId||data.uniqueId||user.nickname||'visitante').slice(0,40);
  const result={type,name,avatar,id:String(data.common?.msgId||data.msgId||'').slice(0,100)};
  if(type==='gift') {
    const gift=data.gift||data.giftDetails||data.extendedGiftInfo||{};
    const streak=Number(gift.type??gift.giftType??data.giftType)===1||gift.combo===true;
    if(streak&&!(data.repeatEnd===true||Number(data.repeatEnd)===1))return null;
    result.giftId=String(data.giftId||gift.id||'');
    result.cost=number(gift.diamondCount??data.extendedGiftInfo?.diamondCount??data.diamondCount);
    result.tier=tierFor(result.cost);
    result.giftName=String(gift.name||gift.giftName||data.extendedGiftInfo?.name||data.giftName||'Presente').slice(0,60);
    result.repeat=Math.max(1,number(data.repeatCount));
    const group=String(data.groupId||'');
    const order=String(data.orderId||'');
    result.deliveryId=streak&&group&&group!=='0'?JSON.stringify([name,result.giftId,'group',group]):order&&order!=='0'?JSON.stringify([name,result.giftId,'order',order]):result.id;
  }
  if(type==='comment')result.comment=String(data.comment||'').slice(0,300);
  if(type==='like'){result.count=number(data.count??data.likeCount);result.total=number(data.total??data.totalLikeCount)}
  if(type==='viewers')result.count=number(data.total??data.viewerCount);
  return result;
}
