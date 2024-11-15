let get = (id)=>{
    return document.getElementById(id)
}

let canvas = get('canvas_simu')
let ctx = canvas.getContext("2d");

let delta = 1;
let lastUpdate = Date.now();
let max_tps = 50.0;

let fuStart=false
let calcArtificialAccel=0;
let ArtificialAccelMoy=0;
let accelsCalcArray=[]
const accelLentghThreshold=2

const maxThrottle = 5
const maxSpeed = 80;
const maxPower = 520

let currentSpeed = 0;
let currentDistance = 0;
let currentPOS = 0;

let GoAuth = false;

let currentThrottle=parseInt(get('train_throttle_input').value)
let currentSlope=parseInt(get('train_slope_input').value)
let currentPower=parseInt(get('train_power_input').value)
let currentAmp=parseInt(get('train_intens_input').value)
let currentVolt=parseInt(get('train_voltage_input').value)
let currentMasse=parseInt(get('train_mass_input').value)
let currentFrottForce=parseInt(get('train_frott_input').value)
let currentBrakePow=parseFloat(get('train_brake_input').value)
let currentPatinage=parseFloat(get('train_pat_input').value)
let currentBrakePowToEqPow=currentBrakePow*520/100;

let djhtTemporisation=0
let djhtCut = false

init()
function init(){
    update();
    requestAnimationFrame(init);
}

let AlarmesPCC = [
    [0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0],
    [
        "pcc_attente_cons","pcc_cons_reject","pcc_control_crb","pcc_waiting_con","pcc_insuf_cons","pcc_apm_hb",
        "pcc_noret_stop","pcc_cmd_fu","pcc_fustate","pcc_null_vit","pcc_def_motorb","pcc_accel_insuf","pcc_meca_brake", "pcc_surint","pcc_djht"
    ]
]

let TrainConsignes = []
let ConsigneArchive = []

class CONSIGNE {
    constructor(pmd, paf, cons, prog, mode, accellim) {
        let CurrSpeedMS=(currentSpeed/3.6)
        let CurrConsVitMS=(cons/3.6)
        let dRes = (paf-pmd)-(currentPOS-pmd)
        let calcAccel=((CurrConsVitMS**2)-(CurrSpeedMS**2))/(2*dRes)
        if(calcAccel<-1.4 || calcAccel>1.4){
            AlarmesPCC[0][1]=2
            AlarmesPCC[1][1]=1
        } else {
            TrainConsignes.push({
                pmd: pmd,
                vit: cons,
                lim: {type: mode, lim: accellim | paf},
                func: prog ? "linear" : "const",
                vd: currentSpeed
            })
        }
    }
}
let fuCpt = 0
let PCC_tick=true
let PCC_Init = ()=>{
    setInterval(()=>{
        PCC_tick=!PCC_tick
        let isAlarm=false
        for(let al in AlarmesPCC[0]){
            if(AlarmesPCC[0][al]===0){
                get(`${AlarmesPCC[2][al]}`).classList.remove("lpccGrn","lpccAlarm")
                get(`${AlarmesPCC[2][al]}`).classList.remove("lpccAcq")
            } else if(AlarmesPCC[0][al]===1){
                get(`${AlarmesPCC[2][al]}`).classList.remove("lpccAlarm")
                get(`${AlarmesPCC[2][al]}`).classList.add("lpccGrn")
                get(`${AlarmesPCC[2][al]}`).classList.remove("lpccAcq")
            } else {
                get(`${AlarmesPCC[2][al]}`).classList.remove("lpccGrn")
                get(`${AlarmesPCC[2][al]}`).classList.add("lpccAlarm")
                get(`${AlarmesPCC[2][al]}`).classList.remove("lpccAcq")
            }
        }
        for(let al in AlarmesPCC[1]){
            if(AlarmesPCC[1][al]===1){
                get(`${AlarmesPCC[2][al]}`).classList.toggle("lpccAcq",PCC_tick)
                isAlarm=true
            }
        }
        if(isAlarm && PCC_tick && typeof SOUND_MANAGER === 'object'){
            SOUND_MANAGER.playSound('pcc', 0.2)
        }
    },400)
}
PCC_Init()

function update(){
    let rn = Date.now();
    let inter = rn - lastUpdate;
    let theorical_inter = 1000.0 / max_tps;
    delta = inter / theorical_inter;
    lastUpdate = rn;
    if(delta>5)delta=5;
    if(delta<=0)return;

    CANVAS_UPDATE()
    HTML_UPDATE()
    SPEED_UPDATE()
    DISTANCE_UPDATE()
    FU_LISTENER()
    DCA_LISTENER()
    if(get('enable_sound').checked){
        if(typeof window.updateSounds==="function"){
            window.updateSounds()
        }
    } else {
        if(typeof SOUND_MANAGER === 'object'){
            SOUND_MANAGER.stopAllSound()
        }
    }
}

let fuBtn=false

function FU_LISTENER(){
    if(fuStart===true){
        get('btn_embrake').disabled=true
        get('btn_embrake_reset').disabled=false
        if(currentSpeed>0){
            get('train_throttle_input').value=0
            currentSpeed += (((-5.6)*((0.52/currentMasse)*1.4)));
        } else {
            if(currentSpeed<0){
                currentSpeed=0
            }
            fuStart=fuBtn
        }
    }
}

function HTML_UPDATE(){
    get('physics_toggle_state').innerText=`${get('enable_physics').checked?"Oui":"Non"}`
    for(let elem of document.getElementsByName('auto_physics')){
        if(elem.checked){
            get('physics_control_state').innerText=`${elem.getAttribute("data-auto_physics")}`
        }
    }

    get('train_slope_state').innerText=`${get('train_slope_input').value}`
    get('train_power_state').innerText=`${get('train_power_input').value}`
    get('train_intens_state').innerText=`${get('train_intens_input').value}`
    get('train_voltage_state').innerText=`${get('train_voltage_input').value}`
    get('train_brake_state').innerText=`${get('train_brake_input').value}`
    get('train_mass_state').innerText=`${get('train_mass_input').value}`
    get('train_frott_state').innerText=`${get('train_frott_input').value}`
    get('train_pat_state').innerText=`${get('train_pat_input').value}`
    for(let elem of document.getElementsByName('auto_control')){
        if(elem.checked){
            get('train_autocontrol_state').innerText=`${elem.getAttribute("data-auto_control")}`
        }
    }
    get('train_throttle_state').innerText=`${get('train_throttle_input').value}`
    get('vaff_enable_state').innerText=`${get('enable_vaff').checked?"Oui":"Non"}`
    get('train_departure_toggle_state').innerText=`${get('enable_depart').checked?"Oui":"Non"}`
    get('train_sound_state').innerText=`${get('enable_sound').checked?"Oui":"Non"}`

    if(get('enable_physics').checked){
        for(let elem of document.getElementsByName('auto_physics')){
            elem.disabled=false
        }
    } else {
        for(let elem of document.getElementsByName('auto_physics')){
            elem.disabled=true
        }
    }
    for(let elem of document.getElementsByName('auto_physics')){
        if(elem.checked){
            if(elem.getAttribute("data-auto_physics")==="Manu"){
                for(let elem2 of document.getElementsByClassName('input_phy')){
                    elem2.disabled=false
                }
            } else {
                for(let elem2 of document.getElementsByClassName('input_phy')){
                    elem2.disabled=true
                }
            }
        }
        if (get('enable_physics').checked===false || elem.getAttribute("data-auto_physics")==="Auto") {
            for(let elem2 of document.getElementsByClassName('input_phy')){
                elem2.disabled=true
            }
        }
    }
    for(let elem of document.getElementsByName('auto_control')){
        if(elem.checked){
            if(elem.getAttribute("data-auto_control")==="Manu"){
                get('train_throttle_input').disabled=false
            } else {
                get('train_throttle_input').disabled=true
            }
        }
    }
    if(get('enable_depart').checked){
        //get('btn_train_departure').disabled=false
    } else {
        get('btn_train_departure').disabled=true
    }

    if(get("consigne_aide_distance_input").checked){
        get('consigne_paflim_input').value=parseInt(get("consigne_dist_input").value)+parseFloat(currentPOS.toFixed(1))
    }

    get('accel_cmd_vit_input_state').innerText=`${get('accel_cmd_vit_input').value}`
    get('decel_cmd_vit_input_state').innerText=`${get('decel_cmd_vit_input').value}`

    get('consigne_vit_input_state').innerText=`${get('consigne_vit_input').value} km/h`
    get('consigne_pmd_input_state').innerText=`PM ${currentPOS.toFixed(2)}`
    get('consigne_courbe_prog_input_state').innerText=`${get('consigne_courbe_prog_input').checked?"Oui":"Non"}`
    for(let elem of document.getElementsByName('radio_lim_type_cons')){
        if(elem.checked){
            get('radio_lim_type_cons_state').innerText=`${elem.getAttribute("data-cons_lim")}`
        }
    }
    get('consigne_aide_distance_input_state').innerText=`${get('consigne_aide_distance_input').checked?"Actif":"Non"}`
    get('consigne_dist_input_state').innerText=`${get('consigne_dist_input').value} m`
    get('consigne_paflim_input_state').innerText=`PM ${get('consigne_paflim_input').value}`
    get('consigne_accel_input_state').innerText=`${get('consigne_accel_input').value} m/s²`

    get('consigne_dist_input').disabled=!get('consigne_aide_distance_input').checked;
    for(let elem of document.getElementsByName('radio_lim_type_cons')){
        if(elem.checked){
            if(elem.getAttribute("data-cons_lim")==="Dist"){
                get('consigne_aide_distance_input').disabled=false
                get('consigne_dist_input').disabled=false
                get('consigne_paflim_input').disabled=false
                get('consigne_accel_input').disabled=true
            } else {
                get('consigne_aide_distance_input').disabled=true
                get('consigne_dist_input').disabled=true
                get('consigne_paflim_input').disabled=true
                get('consigne_accel_input').disabled=false
            }
        }
    }

    get('pcc_cptfu').value=fuCpt
    if(fuCpt>1){
        get('pcc_cptfu').classList.add("lpccAlarm")
    } else {
        get('pcc_cptfu').classList.remove("lpccAlarm")
    }

    get('pcc_queueCons').value=TrainConsignes.length



    currentThrottle=parseFloat(get('train_throttle_input').value)
    currentSlope=parseInt(get('train_slope_input').value)
    currentPower=parseInt(get('train_power_input').value)
    //currentAmp=parseInt(get('train_intens_input').value)
    currentVolt=parseInt(get('train_voltage_input').value)
    currentMasse=parseInt(get('train_mass_input').value)
    currentFrottForce=parseFloat(get('train_frott_input').value)
    currentBrakePow=parseFloat(get('train_brake_input').value)
    currentPatinage=parseFloat(get('train_pat_input').value)
    currentBrakePowToEqPow=currentBrakePow*520/100;
}
let supplement=0
/*setInterval(()=>{
    supplement=0
    if(currentThrottle>0){
        if(calcArtificialAccel*currentThrottle<currentThrottle*(1.37*(currentThrottle/maxThrottle))){
            supplement+=5
        } else if (calcArtificialAccel*currentThrottle>currentThrottle*(1.37*(currentThrottle/maxThrottle))) {
            supplement-=5
        }
    } else if (currentThrottle<0){
        if(calcArtificialAccel*(-currentThrottle)>currentThrottle*(-1.37*(currentThrottle/maxThrottle))){
            //console.log(`${calcArtificialAccel*currentThrottle} ${currentThrottle*(-1.37*(currentThrottle/maxThrottle))}`)
            supplement+=5
        } else if (calcArtificialAccel*(-currentThrottle)<currentThrottle*(-1.37*(currentThrottle/maxThrottle))) {
            supplement-=5
        }
    }
},25)*/
const BasicPhysicAccel=0.016714285714285716
function SPEED_UPDATE(){
    //? On adapte le cran à la puissance moteur
    let throttlePercent = currentThrottle/maxThrottle
    currentPower=Math.abs(throttlePercent*maxPower)
    get('train_power_input').value=currentPower

    supplement=0
    let deltaAccel=0
    let TheoricalAccel=0
    if(currentThrottle>0 && djhtCut===false){
        TheoricalAccel=(1.37*(currentPower/maxPower)**2)
        deltaAccel=ArtificialAccelMoy-TheoricalAccel
    } else if (currentThrottle<0){
        TheoricalAccel=((-1.37)*(currentPower/maxPower)**2)
        deltaAccel=-(ArtificialAccelMoy-TheoricalAccel)
    }
    supplement=((deltaAccel/50)*750)*((currentPower/maxPower)**2)
    if(currentSpeed>=80) {
        supplement=0
        currentAmp=0
    }

    get('traction_tab_debug_accelmoy').innerText=ArtificialAccelMoy.toFixed(2)
    get('traction_tab_debug_acceltheo').innerText=TheoricalAccel.toFixed(2)
    get('traction_tab_debug_deltaaccel').innerText=deltaAccel.toFixed(2)
    get('traction_tab_debug_supp').innerText=supplement.toFixed(2)
    /*console.log("----")
    console.log(`RACCEL ${ArtificialAccelMoy.toFixed(2)}`)
    console.log(`THEORQ ${(1.37*(currentPower/maxPower)).toFixed(2)}`)
    console.log(`DELTA  ${deltaAccel.toFixed(2)}`)
    console.log(`SUPP   ${supplement.toFixed(2)}A`)*/
    /*let calculatedPower = 0;
    if(currentThrottle>0){
        calculatedPower=currentPower
    } else if(currentThrottle<=0){
        calculatedPower=Math.max(currentBrakePowToEqPow,currentPower)
    }
    let accelForce = ((calculatedPower/1000)/currentMasse)*0.9
    let frottforce = currentFrottForce/100
    if(get('enable_physics').checked===false) accelForce=BasicPhysicAccel
    currentSpeed += ((currentThrottle*accelForce));
    if((currentThrottle===0 || calculatedPower<=1) && get('enable_physics').checked) currentSpeed=currentSpeed-(frottforce*1.2)*/
    
    /*if((calcArtificialAccel*currentThrottle<currentThrottle*1.37 && currentThrottle>0)||(calcArtificialAccel*currentThrottle>currentThrottle*-1.37 && currentThrottle<0)){
        supplement+=5
    } else if ((calcArtificialAccel*currentThrottle<currentThrottle*-1.37 && currentThrottle<0)||(calcArtificialAccel*currentThrottle>currentThrottle*1.37 && currentThrottle>0)){
        supplement-=5
    }*/
    currentAmp-=supplement
    let pseudoAmp = currentAmp

    get('train_intens_input').value=currentAmp
    if(currentSpeed===0 && currentThrottle<=0){
        currentAmp=0
        get('train_intens_input').value=0
    } else if (currentSpeed===0 && currentThrottle>0){
        currentAmp=300
        get('train_intens_input').value=300
    }
    if(currentAmp>700){
        currentAmp=700
    }


    let totalMotorPower;
    let globalDiviser=44000

    let today = Date.now()

    let actualVoltage=currentVolt

    if(currentVolt>1000 || currentVolt<100){
        if(actualVoltage>=0 && djhtCut===false){
            djhtTemporisation=Date.now()
            djhtCut=true
        }
        if(today-djhtTemporisation<5000 && djhtCut===true){
            actualVoltage=0
            //currentAmp=0
            get('train_intens_input').value=0
        }
        if(today-djhtTemporisation>5000 && djhtCut===true){
            djhtCut=false
            djhtTemporisation=Date.now()
            actualVoltage=0
            //currentAmp=0
            get('train_intens_input').value=0
        }
    } else if (today-djhtTemporisation>5000 && currentVolt<1000 && currentVolt>100 && djhtCut===true) {
        djhtCut=false
        SOUND_MANAGER.playSound('djht206', 2)
    }
    if(today-djhtTemporisation<5000 && djhtCut===true){
        actualVoltage=0
        //currentAmp=0
        get('train_intens_input').value=0
    }
    
    if(currentThrottle<0){
        let theoricalPower=(actualVoltage*currentAmp)*(Math.min((currentPower*100)/520000,0.1))/globalDiviser
        totalMotorPower=theoricalPower
    } else {
        //get('train_brake_input').value=0
        totalMotorPower=((actualVoltage*currentAmp)*(Math.min((currentPower*100)/520000, 0.1)))/globalDiviser
    }

    if((currentAmp>680 || djhtCut===true) && currentThrottle<0){
        AlarmesPCC[0][12]=1
        //freinage moteur insuffisant, courant faible...
        totalMotorPower=((750*pseudoAmp)*0.1)/globalDiviser
        get('train_brake_input').value=100*pseudoAmp/700
    } else{
        get('train_brake_input').value=0
        AlarmesPCC[0][12]=0
    }

    //totalMotorPower=((750*currentAmp)*(Math.min((currentPower*100)/520000, 1)))/75000
    let accelForce=(totalMotorPower/currentMasse)/0.8
    let frottforce = currentFrottForce/100
    currentSpeed += (((currentThrottle)*accelForce));
    if((currentThrottle===0 || totalMotorPower<=1) && get('enable_physics').checked) currentSpeed=currentSpeed-(frottforce*1.2)

    if(currentSpeed > maxSpeed) currentSpeed = maxSpeed;
    if(currentSpeed < 0) currentSpeed = 0;

    get('actualTrainSpeed').innerText=currentSpeed.toFixed(2)
    get('actualTrainSpeedMS').innerText=(currentSpeed/3.6).toFixed(2)
}

let lastDistance=0;
let lastSpeed=0;

setInterval(()=>{
    let deltadist = currentDistance-lastDistance;
    lastDistance=currentDistance;
    
    get('actualTrainSpeedVKMH').innerText=(deltadist*3.6*20).toFixed(2)
    get('deltaSpeed').innerText=`${Math.abs((deltadist*3.6*20)-currentSpeed).toFixed(2)}`
    if(Math.abs((deltadist*3.6*20)-currentSpeed)>1){
        get('deltaSpeed').style.backgroundColor='red'
        get('deltaSpeed').style.color='white'
    } else {
        get('deltaSpeed').style.background="none"
        get('deltaSpeed').style.color='black'
    }

    let deltaspeed = (currentSpeed/3.6)-lastSpeed;
    lastSpeed=(currentSpeed/3.6);
    calcArtificialAccel=(deltaspeed*20)
    if(accelsCalcArray.length<accelLentghThreshold){
        accelsCalcArray.push(calcArtificialAccel)
    } 
    if (accelsCalcArray.length===accelLentghThreshold){
        let arraySum = 0;
        for(let val of accelsCalcArray) arraySum+=val;
        ArtificialAccelMoy=(arraySum/(accelLentghThreshold))
        accelsCalcArray.shift()
    }
    get('speedAccelOut').innerText=`${calcArtificialAccel.toFixed(2)}`
    get('speedAccelOutG').innerText=`${((deltaspeed*20)/9.81).toFixed(2)}`
},50)



function DISTANCE_UPDATE(){
    currentDistance+=(currentSpeed*delta)/50/3600*1000
    if(true){
        currentPOS+=(currentSpeed*delta)/50/3600*1000
    } else {
        currentPOS-=(currentSpeed*delta)/50/3600*1000
    }

    get('currentPMout').innerText=`${currentPOS.toFixed(1)}`
}

let GlobalImg=[{path: "./src/modern_0.png", id:"tunnelimg", div:2.4},
    {path: "./src/TRAIN.png", id:"trainimg", div:2}]
let LoadedImg={}
for(let img of GlobalImg){
    let imgclass = new Image();
    imgclass.src = img.path;
    imgclass.div = img.div;
    imgclass.onload = () => {
        LoadedImg[img.id]=imgclass
    };
}


function BACKGROUND_FILL(){
    let WallList=[]
    WallList.push({xs: (0-currentPOS*50), xe:(0-currentPOS*50)+(LoadedImg.tunnelimg.width/LoadedImg.tunnelimg.div)})
    let recurs = ()=>{
        if(WallList[WallList.length-1].xe<canvas.width){
            WallList.push({xs: WallList[WallList.length-1].xe, xe:(LoadedImg.tunnelimg.width/LoadedImg.tunnelimg.div)+WallList[WallList.length-1].xe})
            recurs()
        }
    }
    recurs()
    let recurs2 = ()=>{
        if(WallList[0].xe<0){
            WallList.shift()
            recurs2()
        }
    }
    recurs2()
    for(let wall of WallList){
        ctx.drawImage(LoadedImg.tunnelimg, wall.xs, 0, (LoadedImg.tunnelimg.width/LoadedImg.tunnelimg.div), (LoadedImg.tunnelimg.height/LoadedImg.tunnelimg.div))
    }
    ctx.drawImage(LoadedImg.trainimg, 0, 50, (LoadedImg.trainimg.width/LoadedImg.trainimg.div), (LoadedImg.trainimg.height/LoadedImg.trainimg.div));
}
let lastSpeed2 = 0

function SHOW_DETAILS(){
    if(TrainConsignes.length===0) return;
    let CurrCons = TrainConsignes[0]
    ctx.beginPath();
    ctx.moveTo(((CurrCons.pmd-currentPOS)*50)+200, 200-(CurrCons.vd*2));
    ctx.lineTo(((CurrCons.lim.lim-currentPOS)*50)+200, 200-(CurrCons.vit*2));
    ctx.moveTo(((CurrCons.lim.lim-currentPOS)*50)+200, 200-(CurrCons.vit*2));
    ctx.lineTo(((CurrCons.lim.lim-currentPOS)*50)+200, 300);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "blue";
    ctx.stroke();
    ctx.fillStyle="red"
    ctx.beginPath();
    ctx.moveTo(180, 200-((currentSpeed)*2)-10);
    ctx.lineTo(200, 200-(currentSpeed)*2);
    ctx.lineTo(180, 200-((currentSpeed)*2)+10);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "green";
    ctx.beginPath();
    ctx.moveTo(200, 200-((currentSpeed)*2));
    ctx.lineTo(((CurrCons.lim.lim-currentPOS)*50)+200, 200-(CurrCons.vit*2));
    ctx.closePath();
    ctx.stroke();
    //ctx.fillRect(200,200-((currentSpeed)*2), 50, 10)
}

function CANVAS_UPDATE(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,canvas.width, canvas.height)
    if(Object.keys(LoadedImg).length<GlobalImg.length) return;
    BACKGROUND_FILL()
    if(get('canvas_show_details').checked){
        SHOW_DETAILS()
    }
}
let PaInterval=false
let lastAccel=0
let FreqCtrl = 100


let PaIntervalGlobal=setInterval(()=>{
    if(TrainConsignes.length===0) return;
    let CurrCons=TrainConsignes[0]
    if(fuCpt>1) {
        return;
    }
    if(get("enable_depart").checked){
        if(currentSpeed===0 && GoAuth===false){
            return get("btn_train_departure").disabled=false
        } //return get("btn_train_departure").disabled=false
    }
    if(currentSpeed<2){
        get('train_throttle_input').value=2
        currentThrottle=2
    }
    GoAuth=false
    get("btn_train_departure").disabled=true

    let ADVpm=(currentPOS-CurrCons.pmd)/(CurrCons.lim.lim-CurrCons.pmd)
    let dV=currentSpeed-CurrCons.vit
    let Vpm = (adv)=>(dV*(1-adv))+CurrCons.vit;
    let CurrConsVitMS=CurrCons.vit/3.6
    let CurrConsVitAffMS=(CurrCons.vit/3.6)*0.90
    let CurrSpeedMS=(currentSpeed/3.6)
    let CurrSpeedAffMS=(currentSpeed/3.6)*1.1
    let dRes = (CurrCons.lim.lim-CurrCons.pmd)-(currentPOS-CurrCons.pmd)
    let calcAccel=((CurrConsVitMS**2)-(CurrSpeedMS**2))/(2*dRes)
    let calcAccelAff=((CurrConsVitMS**2)-(CurrSpeedMS**2))/(2*dRes)
    let accelToDist = (((Vpm(ADVpm+0.05)/3.6)**2)-(CurrSpeedMS**2))/(2*((CurrCons.lim.lim-CurrCons.pmd)*(1-(ADVpm+0.05))))

    lastAccel=calcAccel
    let accelToCran;
    massRapp=(28/42)*1.39
    if(get('enable_vaff').checked){
        accelToCran=parseFloat(((calcAccel*5)/massRapp).toFixed(2))
    } else {
        accelToCran=parseFloat(((calcAccel*5)/massRapp).toFixed(2))
    }
    /*console.log(`
        APM             : ${ADVpm}
        VITESSE ACTUELLE: ${CurrSpeedMS.toFixed(2)}m/s
        VITESSE ATTENDUE: ${(Vpm(ADVpm)/3.6).toFixed(2)}m/s
        DELTA V         : ${CurrSpeedMS-(Vpm(ADVpm)/3.6).toFixed(2)}m/s
        ACCEL CALCULEE  : ${calcAccel.toFixed(2)}m/s²
        ACCEL THEORIQUE : ${accelToDist.toFixed(2)}m/s²
        EQUIVALENT CRAN : ${accelToCran.toFixed(2)} cran
    `)*/
    get("pae_calc_cons_vit").innerText=`${CurrCons.vit}km/h`
    get("pae_calc_type").innerText=`${CurrCons.vit<currentSpeed?"Décélération":"Acceleration"}`
    get("pae_calc_consDist").innerText=`${(CurrCons.lim.lim-CurrCons.pmd).toFixed(2)}m`
    get("pae_calc_rest_dist").innerText=`${dRes.toFixed(2)}m`
    get("pae_calc_apm").innerText=`${ADVpm.toFixed(2)}`
    get("pae_calc_vit_pm").innerText=`${Vpm(ADVpm).toFixed(2)}km/h`
    get("pae_calc_deltav").innerText=`${(Vpm(ADVpm)-currentSpeed).toFixed(2)}km/h`
    get("pae_calc_accelcalc").innerText=`${calcAccel.toFixed(2)}m/s²`
    get("pae_calc_eqcran").innerText=`${accelToCran.toFixed(2)}c`
    if(accelToCran>5){
        AlarmesPCC[0][11]=2
        AlarmesPCC[1][11]=1
    } else {
        AlarmesPCC[0][11]=0
    }
    if(accelToCran<(-6) && ADVpm<0.99){
        fuStart=true
        fuCpt++;
        get('train_throttle_input').value=0
        currentThrottle=0
        lastAccel=0
        fuTriggered=true
        AlarmesPCC[0][7]=2
        AlarmesPCC[1][7]=1
        AlarmesPCC[0][2]=2
        AlarmesPCC[1][2]=1
        console.log(ADVpm)
    } else {
        get('train_throttle_input').value=accelToCran
        currentThrottle=accelToCran
    }
    if(CurrCons.vit<1 && currentSpeed>1 && currentSpeed<1.5) {
        get('train_throttle_input').value=-1
        currentThrottle=-1
    }
    if(CurrCons.vit<1 && currentSpeed<0.1) {
        TrainConsignes.shift()
        lastAccel=0
        lastSpeed2 = 0
        get('train_throttle_input').value=-1
        currentThrottle=-1
    }


    if(ADVpm>1 && (currentSpeed>(CurrCons.vit*1.1) && currentSpeed<(CurrCons.vit*0.95))){
        TrainConsignes.shift()
        console.log("Dépassement ADV")
        fuStart=true
        fuCpt++;
        get('train_throttle_input').value=0
        currentThrottle=0
        fuTriggered=true
        lastAccel=0

        AlarmesPCC[0][7]=2
        AlarmesPCC[1][7]=1
        AlarmesPCC[0][5]=2
        AlarmesPCC[1][5]=1
    } else if (ADVpm>1 && (currentSpeed<(CurrCons.vit*1.1) && currentSpeed>(CurrCons.vit*0.95))){
        TrainConsignes.shift()
        currentThrottle=0
        get('train_throttle_input').value=0
        lastAccel=0
    } else if (ADVpm===1 || ADVpm>1){
        TrainConsignes.shift()
        currentThrottle=0
        get('train_throttle_input').value=0
        lastAccel=0
        AlarmesPCC[0][5]=2
        AlarmesPCC[1][5]=1
    }
},FreqCtrl)


function DCA_LISTENER(){
    if(fuStart || currentSpeed===0){
        AlarmesPCC[0][8]=1
    } else {
        AlarmesPCC[0][8]=0
        AlarmesPCC[0][7]=0
    }

    if(currentSpeed===0){
        AlarmesPCC[0][9]=1
        AlarmesPCC[0][5]=0
        AlarmesPCC[0][2]=0
        AlarmesPCC[0][1]=0
        AlarmesPCC[0][1]=0
        AlarmesPCC[0][11]=0
        AlarmesPCC[0][10]=0
    } else {
        AlarmesPCC[0][9] = 0
    }

    if(fuBtn){
        AlarmesPCC[0][7]=2
        AlarmesPCC[1][7]=1
    }

    if(TrainConsignes.length===0){
        AlarmesPCC[0][0]=1
    } else {
        AlarmesPCC[0][0]=0
    }

    if(currentAmp>690 && djhtCut===false){
        AlarmesPCC[0][13] = 2
        AlarmesPCC[1][13] = 1
    } else {
        AlarmesPCC[0][13] = 0
    }

    if(djhtCut===true && AlarmesPCC[0][14] === 0){
        AlarmesPCC[0][14] = 2
        AlarmesPCC[1][14] = 1
        SOUND_MANAGER.playSound('djht206', 2)
    } else if (djhtCut===false && currentVolt>100 && currentVolt<1000){
        AlarmesPCC[0][14] = 0
    }

}

get('btn_quick_setup').addEventListener('click',()=>{
    get('enable_physics').checked=true
    get('auto_physic_radio_elem').checked=true
    get('train_frott_input').value=0.5
    get('auto_control_radio_elem').checked=true
    get("enable_sound").checked=true
    get('btn_quick_sysstop').disabled=false
    get('btn_quick_setup').disabled=true
})

get('btn_quick_sysstop').addEventListener('click',()=>{
    get('manual_physic_radio_elem').checked=true
    get('manual_control_radio_elem').checked=true
    get('btn_quick_sysstop').disabled=true
    get('btn_quick_setup').disabled=false
})

get('btn_embrake').addEventListener('click',()=>{
    fuTriggered=true
    fuStart=true
    fuCpt++;
    fuBtn=true
    get('btn_embrake').disabled=true
    get('btn_embrake_reset').disabled=false
})
get('btn_embrake_reset').addEventListener('click',()=>{
    fuTriggered=false
    fuStart=false
    fuBtn=false
    get('btn_embrake').disabled=false
    get('btn_embrake_reset').disabled=true
})

get("consigne_send_manual").addEventListener("click",()=>{
    let Cons = new CONSIGNE(currentPOS, parseFloat(get('consigne_paflim_input').value), parseInt(get('consigne_vit_input').value), get("consigne_courbe_prog_input").checked, get("radio_lim_type_cons_state").innerText, parseFloat(get("consigne_accel_input").value))
})

get('btn_train_departure').addEventListener('mousedown',()=>{
    GoAuth=true
})
get('btn_train_departure').addEventListener('mouseup',()=>{
    GoAuth=false
})

get('pcc_acq').addEventListener('click',()=>{
    for(let al in AlarmesPCC[1]){
        AlarmesPCC[1][al]=0
    }
})

get('pcc_btn_acqfu').addEventListener('click',()=>{
    if(fuCpt>1) return fuCpt--;
})

get('pcc_inter_ordre').addEventListener('click',()=>{
    TrainConsignes.shift()
})