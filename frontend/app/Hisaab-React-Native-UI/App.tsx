import React, { useMemo, useState } from 'react';
import {
  Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Switch, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#021612', panel: '#07251E', panel2: '#0A3026', line: '#1A5C48',
  green: '#55E7A0', green2: '#16B96F', white: '#F6FAF8', muted: '#93AAA2',
  gold: '#F5D98B', red: '#FF675F', orange: '#FF9F43',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type MainTab = 'Home' | 'Finance' | 'Add' | 'Transactions' | 'Profile';
type AuthPage = 'login' | 'signup' | 'forgot' | 'otp' | 'reset';
type Screen = MainTab | 'Feature' | 'Settings' | 'Subscription';

const financeTools: { title: string; subtitle: string; icon: IconName; pro?: boolean }[] = [
  { title: 'Overview', subtitle: 'Money snapshot', icon: 'home-outline' },
  { title: 'Transactions', subtitle: 'Track activity', icon: 'swap-horizontal-outline' },
  { title: 'Bank', subtitle: 'Balances & accounts', icon: 'business-outline' },
  { title: 'Spending Limits', subtitle: 'View & plan monthly', icon: 'speedometer-outline' },
  { title: 'Analytics', subtitle: 'Deep insights', icon: 'bar-chart-outline', pro: true },
  { title: 'Savings Goals', subtitle: 'Save smarter', icon: 'radio-button-on-outline' },
  { title: 'Accounts', subtitle: 'All bank balances', icon: 'wallet-outline' },
  { title: 'Investments', subtitle: 'MF, stocks & gold', icon: 'trending-up-outline' },
  { title: 'IPO Tracker', subtitle: 'Applied & allotment', icon: 'cash-outline' },
  { title: 'EMI & Loans', subtitle: 'Due dates & payments', icon: 'timer-outline' },
  { title: 'Credit Cards', subtitle: 'Limit, due & overdue', icon: 'card-outline' },
  { title: 'UPI Credit', subtitle: 'Used & remaining limit', icon: 'phone-portrait-outline' },
  { title: 'Bills & Reminders', subtitle: 'Never miss a due date', icon: 'notifications-outline' },
  { title: 'Borrow / Lend', subtitle: 'Track money with dates', icon: 'people-outline' },
  { title: 'AI Financial Coach', subtitle: 'Personal money guidance', icon: 'sparkles-outline', pro: true },
  { title: 'Premium', subtitle: 'Upgrade tools', icon: 'diamond-outline', pro: true },
];

const txns = [
  ['Salary Credit', 'HDFC Bank · 1234', '+ ₹89,750', C.green, 'arrow-down-outline'],
  ['Amazon Pay', 'Shopping', '- ₹2,499', C.red, 'cart-outline'],
  ['Swiggy', 'Food & Dining', '- ₹623', C.red, 'fast-food-outline'],
  ['UPI to Rahul', 'UPI · 9876', '- ₹1,200', C.red, 'paper-plane-outline'],
  ['Freelance Payment', 'HDFC Bank · 5678', '+ ₹15,000', C.green, 'briefcase-outline'],
] as const;

function Icon({ name, size = 21, color = C.green }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function AppButton({ label, onPress, outline = false }: { label: string; onPress: () => void; outline?: boolean }) {
  return <Pressable onPress={onPress} style={[s.button, outline && s.buttonOutline]}>
    <Text style={[s.buttonText, outline && { color: C.green }]}>{label}</Text><Icon name="arrow-forward" color={outline ? C.green : '#022018'} />
  </Pressable>;
}

function Field({ label, placeholder, secure }: { label: string; placeholder: string; secure?: boolean }) {
  return <View style={{ gap: 8 }}><Text style={s.label}>{label}</Text><TextInput placeholder={placeholder} placeholderTextColor={C.muted} secureTextEntry={secure} style={s.input} /></View>;
}

function Auth({ page, setPage, finish }: { page: AuthPage; setPage: (p: AuthPage) => void; finish: () => void }) {
  const copy = {
    login: ['Welcome Back 👋', 'Login to continue to Hisaab'], signup: ['Create your Hisaab', 'Create your private money space'],
    forgot: ['Forgot Password', 'Enter your email and we’ll send a reset code'], otp: ['Verify OTP', 'Enter the 6-digit code sent to your email'],
    reset: ['Create New Password', 'Choose a strong password you have not used before'],
  }[page];
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" /><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled">
    <View style={s.brandMark}><Text style={{ color: C.green, fontSize: 30, fontWeight: '900' }}>H</Text></View>
    <Text style={s.h1}>{copy[0]}</Text><Text style={s.subtitle}>{copy[1]}</Text>
    <View style={[s.card, { gap: 18, marginTop: 22 }]}>
      {page === 'signup' && <Field label="Full name" placeholder="Enter your full name" />}
      {(page === 'login' || page === 'signup' || page === 'forgot') && <Field label="Email address" placeholder="name@example.com" />}
      {(page === 'login' || page === 'signup' || page === 'reset') && <Field label={page === 'reset' ? 'New password' : 'Password'} placeholder="Enter your password" secure />}
      {(page === 'signup' || page === 'reset') && <Field label="Confirm password" placeholder="Re-enter your password" secure />}
      {page === 'otp' && <View style={s.otpRow}>{['2','8','4','6','1','9'].map((x,i)=><View key={i} style={s.otp}><Text style={s.otpText}>{x}</Text></View>)}</View>}
      {page === 'login' && <Pressable onPress={() => setPage('forgot')}><Text style={s.link}>Forgot Password?</Text></Pressable>}
      <AppButton label={page === 'login' ? 'Login' : page === 'signup' ? 'Create account' : page === 'forgot' ? 'Send reset code' : page === 'otp' ? 'Verify OTP' : 'Update password'} onPress={() => {
        if (page === 'login') finish(); else if (page === 'forgot') setPage('otp'); else if (page === 'otp') setPage('reset'); else if (page === 'reset') setPage('login'); else finish();
      }} />
    </View>
    <Pressable onPress={() => setPage(page === 'login' ? 'signup' : 'login')}><Text style={[s.center, s.link]}>{page === 'login' ? 'New here? Create an account' : 'Back to sign in'}</Text></Pressable>
    <View style={s.security}><Icon name="shield-checkmark-outline" /><View><Text style={s.itemTitle}>Secure & Private</Text><Text style={s.small}>Your financial data stays protected.</Text></View></View>
  </ScrollView></SafeAreaView>;
}

function Header({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <View style={s.header}><View><Text style={s.h1}>{title}</Text>{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>{action}</View>;
}

function SummaryCard() {
  return <View style={[s.card, s.hero]}><Text style={s.eyebrow}>TOTAL BALANCE</Text><Text style={s.balance}>₹4,85,230<Text style={{ fontSize: 18 }}>.50</Text></Text><Text style={s.positive}>▲ 12.45%  <Text style={s.small}>vs last month</Text></Text>
    <View style={s.spark}>{[16,30,23,42,35,52,46,64,55,78,66,92].map((h,i)=><View key={i} style={[s.bar,{height:h/2}]} />)}</View>
  </View>;
}

function Home({ openFeature }: { openFeature: (t: string) => void }) {
  return <ScrollView contentContainerStyle={s.page}><Header title="Good morning," subtitle="Abhinav Mangal 👋" action={<View style={s.avatar}><Text style={s.avatarText}>AM</Text></View>} />
    <SummaryCard />
    <View style={s.quick}>{([['Add Money','add-circle-outline'],['Send Money','swap-horizontal-outline'],['Scan & Pay','scan-outline'],['My Cards','card-outline']] as const).map(([t,i])=><Pressable key={t} style={s.quickItem} onPress={()=>openFeature(t)}><View style={s.iconBox}><Icon name={i}/></View><Text style={s.quickText}>{t}</Text></Pressable>)}</View>
    <SectionTitle title="Quick Overview" />
    <View style={s.grid3}><Metric label="Income" value="₹89,750" color={C.green}/><Metric label="Expenses" value="₹46,250" color={C.red}/><Metric label="Net Savings" value="₹43,500" color={C.gold}/></View>
    <View style={s.card}><SectionTitle title="Cash Flow This Month"/><View style={s.chart}>{[28,35,31,42,38,48,43,56,51,66,60,78,70,90].map((h,i)=><View key={i} style={[s.chartBar,{height:h}]} />)}</View></View>
    <SectionTitle title="Recent Activity" action="See all"/><TransactionList limit={4}/>
  </ScrollView>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) { return <View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{action && <Text style={s.link}>{action}</Text>}</View>; }
function Metric({ label, value, color }: { label:string; value:string; color:string }) { return <View style={s.metric}><Text style={s.small}>{label}</Text><Text style={s.metricValue}>{value}</Text><Text style={{ color, fontWeight:'700' }}>▲ 12.4%</Text></View>; }

function Finance({ openFeature }: { openFeature: (t: string) => void }) {
  return <ScrollView contentContainerStyle={s.page}><Header title="Finance" subtitle="All your financial tools" action={<Icon name="search-outline" size={28}/>} />
    <View style={[s.card,s.financeHero]}><View style={{ flex:1 }}><Text style={s.cardTitle}>Your Financial World</Text><Text style={s.subtitle}>Manage, grow & protect your money</Text></View><Icon name="trending-up" size={64}/></View>
    <SectionTitle title="EVERYDAY FINANCE"/><View style={s.toolGrid}>{financeTools.slice(0,6).map(x=><Tool key={x.title} {...x} onPress={()=>openFeature(x.title)}/>)}</View>
    <SectionTitle title="GROW & PLAN"/><View style={s.toolGrid}>{financeTools.slice(6,12).map(x=><Tool key={x.title} {...x} onPress={()=>openFeature(x.title)}/>)}</View>
    <SectionTitle title="MORE FINANCE TOOLS"/>{financeTools.slice(12).map(x=><Tool key={x.title} {...x} wide onPress={()=>openFeature(x.title)}/>) }
  </ScrollView>;
}

function Tool({ title, subtitle, icon, pro, wide, onPress }: { title:string; subtitle:string; icon:IconName; pro?:boolean; wide?:boolean; onPress:()=>void }) {
  return <Pressable onPress={onPress} style={[s.tool, wide && s.toolWide]}><View style={s.iconBox}><Icon name={icon}/></View><View style={{ flex:1 }}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={s.itemTitle}>{title}</Text>{pro&&<Text style={s.pro}>PRO</Text>}</View><Text style={s.small}>{subtitle}</Text></View><Icon name="chevron-forward" size={17} color={C.muted}/></Pressable>;
}

function TransactionList({ limit = 5 }: { limit?: number }) { return <View style={s.list}>{txns.slice(0,limit).map(([name,sub,amount,color,icon])=><View key={name} style={s.txn}><View style={s.iconBox}><Icon name={icon as IconName}/></View><View style={{flex:1}}><Text style={s.itemTitle}>{name}</Text><Text style={s.small}>{sub}</Text></View><Text style={{color,fontWeight:'800'}}>{amount}</Text></View>)}</View>; }

function Transactions() { const [filter,setFilter]=useState('All'); return <ScrollView contentContainerStyle={s.page}><Header title="Transactions" subtitle="Track all your activities" action={<Icon name="search-outline" size={28}/>} />
  <View style={s.filters}>{['All','Income','Expense','Transfer'].map(x=><Pressable key={x} onPress={()=>setFilter(x)} style={[s.pill,filter===x&&s.pillActive]}><Text style={filter===x?s.pillTextActive:s.pillText}>{x}</Text></Pressable>)}</View>
  <SectionTitle title="Today"/><TransactionList/><SectionTitle title="Earlier"/><TransactionList limit={3}/>
  </ScrollView>; }

function AddTransaction({ done }: { done:()=>void }) { const [kind,setKind]=useState('Expense'); return <ScrollView contentContainerStyle={s.page}><Header title="Add Transaction" subtitle="Choose what you want to add"/>
  <View style={s.filters}>{['Expense','Income','Transfer'].map(x=><Pressable key={x} onPress={()=>setKind(x)} style={[s.kind,kind===x&&s.kindActive]}><Icon name={x==='Expense'?'arrow-down':x==='Income'?'arrow-up':'swap-horizontal'} color={kind===x?C.green:C.muted}/><Text style={s.itemTitle}>{x}</Text></Pressable>)}</View>
  <View style={[s.card,{gap:18}]}><Field label="Amount" placeholder="₹ 0.00"/><Field label="Category" placeholder="Select category"/><Field label="Account" placeholder="Select account"/><Field label="Date" placeholder="Today"/><Field label="Note" placeholder="Add an optional note"/><AppButton label="Save transaction" onPress={()=>{Alert.alert('Saved','Your transaction was added.');done();}}/></View>
  <SectionTitle title="Frequently Used"/><View style={s.quick}>{([['Food','fast-food-outline'],['Shopping','bag-outline'],['Fuel','car-outline'],['Bills','receipt-outline']] as const).map(([t,i])=><View key={t} style={s.quickItem}><View style={s.iconBox}><Icon name={i}/></View><Text style={s.quickText}>{t}</Text></View>)}</View>
  </ScrollView>; }

function Profile({ go }: { go:(x:'Settings'|'Subscription')=>void }) { return <ScrollView contentContainerStyle={s.page}><Header title="Profile" action={<Pressable onPress={()=>go('Settings')} style={s.round}><Icon name="settings-outline"/></Pressable>}/>
  <View style={[s.card,s.profileCard]}><View style={s.bigAvatar}><Text style={s.bigAvatarText}>AM</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>Abhinav Mangal</Text><Text style={s.subtitle}>abhinav@example.com</Text><Text style={s.member}>♛ Premium Member</Text></View></View>
  <Pressable onPress={()=>go('Subscription')} style={[s.button,s.manage]}><Icon name="diamond-outline"/><Text style={[s.buttonText,{color:C.green,flex:1}]}>Manage Subscription</Text><Icon name="chevron-forward"/></Pressable>
  <View style={[s.card,s.score]}><View><Text style={s.cardTitle}>Financial Health Score</Text><Text style={s.subtitle}>Keep building healthy money habits.</Text></View><View style={s.scoreRing}><Text style={s.scoreNum}>78</Text><Text style={s.positive}>Good</Text></View></View>
  <MenuGroup title="ACCOUNT" items={[['Personal Information','person-outline'],['Linked Accounts','link-outline'],['Security & Privacy','shield-checkmark-outline'],['Settings','settings-outline']]} onPress={(x)=>x==='Settings'&&go('Settings')}/>
  <MenuGroup title="PREFERENCES" items={[['Notifications','notifications-outline'],['Appearance','moon-outline','Dark'],['Language','globe-outline','English'],['Currency','cash-outline','INR (₹)']]}/>
  <MenuGroup title="SUPPORT" items={[['Help & Support','help-circle-outline'],['Terms & Privacy','document-text-outline'],['About Hisaab','information-circle-outline']]}/>
  <Pressable style={s.logout} onPress={()=>Alert.alert('Log out','Connect this action to your auth service.')}><Icon name="log-out-outline" color={C.red}/><Text style={{color:C.red,fontWeight:'800'}}>Log out</Text></Pressable><Text style={s.center}>Hisaab v1.0.0</Text>
  </ScrollView>; }

function MenuGroup({title,items,onPress}:{title:string;items:(string[])[];onPress?:(x:string)=>void}) { return <View><SectionTitle title={title}/><View style={s.list}>{items.map(([name,icon,value])=><Pressable key={name} onPress={()=>onPress?.(name!)} style={s.menuRow}><View style={s.iconBox}><Icon name={icon as IconName}/></View><Text style={[s.itemTitle,{flex:1}]}>{name}</Text>{value&&<Text style={s.small}>{value}</Text>}<Icon name="chevron-forward" size={17} color={C.muted}/></Pressable>)}</View></View>; }

function Feature({ title, back }: { title:string; back:()=>void }) { const tool=financeTools.find(x=>x.title===title); return <ScrollView contentContainerStyle={s.page}><Back back={back}/><View style={s.featureHero}><View style={s.featureIcon}><Icon name={tool?.icon||'wallet-outline'} size={44}/></View><Text style={s.h1}>{title}</Text><Text style={s.subtitle}>{tool?.subtitle||'Manage your money with confidence'}</Text></View>
  <View style={s.grid3}><Metric label="This month" value="₹46,250" color={C.red}/><Metric label="Available" value="₹78,400" color={C.green}/><Metric label="Change" value="+12.4%" color={C.gold}/></View>
  <View style={s.card}><SectionTitle title="Monthly activity"/><View style={s.chart}>{[34,50,40,65,55,73,62,88,77,98].map((h,i)=><View key={i} style={[s.chartBar,{height:h}]} />)}</View></View><SectionTitle title="Recent activity"/><TransactionList/>
  </ScrollView>; }

function Back({back}:{back:()=>void}) { return <Pressable onPress={back} style={s.back}><Icon name="arrow-back"/><Text style={s.link}>Back</Text></Pressable>; }
function Settings({back}:{back:()=>void}) { const [biometric,setBiometric]=useState(true); const [push,setPush]=useState(true); return <ScrollView contentContainerStyle={s.page}><Back back={back}/><Header title="Settings" subtitle="Control your Hisaab experience"/>
  <MenuGroup title="GENERAL" items={[['Personal Information','person-outline'],['Default Currency','cash-outline','INR (₹)'],['Language','globe-outline','English'],['Theme','moon-outline','Dark']]}/>
  <SectionTitle title="SECURITY"/><View style={s.list}><ToggleRow label="Biometric login" icon="finger-print-outline" value={biometric} setValue={setBiometric}/><ToggleRow label="Push notifications" icon="notifications-outline" value={push} setValue={setPush}/></View>
  <MenuGroup title="DATA" items={[['Export Transactions','download-outline'],['Backup & Sync','cloud-upload-outline'],['Delete Account','trash-outline']]}/>
  </ScrollView>; }
function ToggleRow({label,icon,value,setValue}:{label:string;icon:IconName;value:boolean;setValue:(v:boolean)=>void}) { return <View style={s.menuRow}><View style={s.iconBox}><Icon name={icon}/></View><Text style={[s.itemTitle,{flex:1}]}>{label}</Text><Switch value={value} onValueChange={setValue} trackColor={{true:C.green2}}/></View>; }

function Subscription({back}:{back:()=>void}) { return <ScrollView contentContainerStyle={s.page}><Back back={back}/><Header title="Hisaab Premium" subtitle="Choose the plan that fits your goals"/>
  <View style={[s.card,s.premiumCard]}><Text style={s.pro}>CURRENT PLAN</Text><Text style={s.h1}>Premium Annual</Text><Text style={s.balance}>₹999<Text style={{fontSize:16}}>/year</Text></Text><Text style={s.subtitle}>Renews on 14 September 2027</Text></View>
  <SectionTitle title="YOUR BENEFITS"/>{['Advanced analytics','AI Financial Coach','Unlimited accounts','Smart bill reminders','Priority support'].map(x=><View key={x} style={s.benefit}><Icon name="checkmark-circle"/><Text style={s.itemTitle}>{x}</Text></View>)}
  <AppButton label="Manage payment method" onPress={()=>Alert.alert('Payment method','Connect your payment provider here.')}/><AppButton outline label="Cancel subscription" onPress={()=>Alert.alert('Cancel subscription','Add your cancellation confirmation flow here.')}/>
  </ScrollView>; }

function BottomNav({ tab, setTab }: { tab: MainTab; setTab:(t:MainTab)=>void }) { const items:[MainTab,IconName][]=[['Home','home-outline'],['Finance','bar-chart-outline'],['Add','add'],['Transactions','swap-horizontal-outline'],['Profile','person-outline']]; return <View style={s.bottom}>{items.map(([name,icon])=><Pressable key={name} onPress={()=>setTab(name)} style={[s.navItem,name==='Add'&&s.addNav]}><Icon name={icon} size={name==='Add'?28:23} color={tab===name||name==='Add'?C.green:C.muted}/><Text style={[s.navText,tab===name&&{color:C.green}]}>{name}</Text></Pressable>)}</View>; }

export default function App() {
  const [signedIn,setSignedIn]=useState(false); const [auth,setAuth]=useState<AuthPage>('login'); const [screen,setScreen]=useState<Screen>('Home'); const [feature,setFeature]=useState('Overview');
  const tab:MainTab = (['Home','Finance','Add','Transactions','Profile'].includes(screen) ? screen : 'Profile') as MainTab;
  const openFeature=(t:string)=>{ if(t==='Transactions'){setScreen('Transactions');return;} setFeature(t);setScreen('Feature'); };
  const content=useMemo(()=>{
    if(screen==='Home')return <Home openFeature={openFeature}/>; if(screen==='Finance')return <Finance openFeature={openFeature}/>; if(screen==='Add')return <AddTransaction done={()=>setScreen('Transactions')}/>; if(screen==='Transactions')return <Transactions/>; if(screen==='Profile')return <Profile go={setScreen}/>; if(screen==='Settings')return <Settings back={()=>setScreen('Profile')}/>; if(screen==='Subscription')return <Subscription back={()=>setScreen('Profile')}/>; return <Feature title={feature} back={()=>setScreen('Finance')}/>;
  },[screen,feature]);
  if(!signedIn)return <Auth page={auth} setPage={setAuth} finish={()=>setSignedIn(true)}/>;
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={{flex:1}}>{content}</View>{screen!=='Feature'&&screen!=='Settings'&&screen!=='Subscription'&&<BottomNav tab={tab} setTab={setScreen}/>}</SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg}, page:{padding:18,paddingBottom:30,gap:14}, authWrap:{padding:24,paddingTop:70,gap:16,minHeight:'100%',justifyContent:'center'},
  brandMark:{width:64,height:64,borderRadius:20,backgroundColor:C.panel2,borderWidth:1,borderColor:C.green,alignItems:'center',justifyContent:'center',alignSelf:'center'},
  h1:{color:C.white,fontSize:34,fontWeight:'900',letterSpacing:-1}, subtitle:{color:C.muted,fontSize:15,lineHeight:22}, label:{color:C.white,fontWeight:'700'}, center:{color:C.muted,textAlign:'center'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4}, card:{backgroundColor:C.panel,borderRadius:20,borderWidth:1,borderColor:C.line,padding:18},
  input:{height:54,borderRadius:14,borderWidth:1,borderColor:C.line,paddingHorizontal:16,color:C.white,backgroundColor:'#041D18'},
  button:{height:54,borderRadius:15,paddingHorizontal:20,backgroundColor:C.green,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},buttonOutline:{backgroundColor:'transparent',borderWidth:1,borderColor:C.green},buttonText:{fontSize:16,fontWeight:'900',color:'#022018'},
  link:{color:C.green,fontWeight:'700'},security:{flexDirection:'row',gap:12,alignItems:'center',padding:16,borderWidth:1,borderColor:C.line,borderRadius:16},
  otpRow:{flexDirection:'row',justifyContent:'space-between'},otp:{width:43,height:52,borderRadius:12,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},otpText:{fontSize:20,color:C.white,fontWeight:'800'},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:C.panel2,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},avatarText:{color:C.white,fontWeight:'800'},
  eyebrow:{fontSize:11,color:C.muted,fontWeight:'800',letterSpacing:1.5},hero:{minHeight:160,overflow:'hidden'},balance:{fontSize:32,color:C.white,fontWeight:'900',marginVertical:8},positive:{color:C.green,fontWeight:'800'},small:{fontSize:12,color:C.muted,lineHeight:17},
  spark:{position:'absolute',right:18,bottom:20,flexDirection:'row',alignItems:'flex-end',gap:4},bar:{width:5,borderRadius:4,backgroundColor:C.green},
  quick:{flexDirection:'row',justifyContent:'space-between'},quickItem:{width:'24%',alignItems:'center',gap:7},iconBox:{width:42,height:42,borderRadius:12,backgroundColor:C.panel2,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},quickText:{color:C.white,fontSize:11,textAlign:'center'},
  sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4},sectionTitle:{color:C.muted,fontSize:13,fontWeight:'900',letterSpacing:1.3},grid3:{flexDirection:'row',gap:8},metric:{flex:1,minHeight:90,padding:12,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.panel},metricValue:{fontSize:16,color:C.white,fontWeight:'800',marginVertical:7},
  cardTitle:{fontSize:20,color:C.white,fontWeight:'900'},chart:{height:110,flexDirection:'row',alignItems:'flex-end',gap:9,justifyContent:'space-around'},chartBar:{width:12,borderRadius:8,backgroundColor:C.green2},
  list:{borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,overflow:'hidden'},txn:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},itemTitle:{color:C.white,fontSize:14,fontWeight:'800'},
  financeHero:{minHeight:130,flexDirection:'row',alignItems:'center'},toolGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},tool:{width:'48.8%',minHeight:86,flexDirection:'row',alignItems:'center',gap:9,padding:11,borderRadius:15,borderWidth:1,borderColor:C.line,backgroundColor:C.panel},toolWide:{width:'100%',minHeight:70},pro:{fontSize:10,color:'#372500',fontWeight:'900',backgroundColor:C.gold,paddingHorizontal:7,paddingVertical:4,borderRadius:10},
  filters:{flexDirection:'row',gap:8},pill:{flex:1,paddingVertical:10,borderRadius:20,borderWidth:1,borderColor:C.line,alignItems:'center'},pillActive:{backgroundColor:C.green},pillText:{color:C.muted},pillTextActive:{color:'#022018',fontWeight:'900'},kind:{flex:1,alignItems:'center',gap:6,padding:14,borderRadius:15,borderWidth:1,borderColor:C.line,backgroundColor:C.panel},kindActive:{backgroundColor:C.panel2,borderColor:C.green},
  round:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},profileCard:{flexDirection:'row',alignItems:'center',gap:15},bigAvatar:{width:78,height:78,borderRadius:39,borderWidth:2,borderColor:C.green,alignItems:'center',justifyContent:'center'},bigAvatarText:{fontSize:26,color:C.white,fontWeight:'900'},member:{color:'#3A2A02',backgroundColor:C.gold,paddingVertical:5,paddingHorizontal:10,borderRadius:12,fontWeight:'800',alignSelf:'flex-start',marginTop:7},manage:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line},
  score:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},scoreRing:{width:94,height:94,borderRadius:47,borderWidth:9,borderColor:C.green,alignItems:'center',justifyContent:'center'},scoreNum:{fontSize:27,color:C.white,fontWeight:'900'},menuRow:{minHeight:62,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},logout:{height:58,borderRadius:15,borderWidth:1,borderColor:C.red,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18},
  featureHero:{alignItems:'center',gap:10,paddingVertical:20},featureIcon:{width:84,height:84,borderRadius:28,backgroundColor:C.panel2,borderWidth:1,borderColor:C.green,alignItems:'center',justifyContent:'center'},back:{flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start'},premiumCard:{borderColor:C.gold,backgroundColor:'#172717'},benefit:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:14,backgroundColor:C.panel},
  bottom:{height:78,flexDirection:'row',alignItems:'center',justifyContent:'space-around',backgroundColor:'#031B16',borderTopWidth:1,borderTopColor:C.line,paddingBottom:8},navItem:{flex:1,alignItems:'center',gap:4},navText:{color:C.muted,fontSize:11},addNav:{marginTop:-17},
});
