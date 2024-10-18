//    ____                  _           __        __         _                     
//   / ___|  ___ _ ____   _(_) ___ ___  \ \      / /__  _ __| | _____ _ __         
//   \___ \ / _ \ '__\ \ / / |/ __/ _ \  \ \ /\ / / _ \| '__| |/ / _ \ '__|        
//    ___) |  __/ |   \ V /| | (_|  __/   \ V  V / (_) | |  |   <  __/ |           
//   |____/ \___|_|    \_/ |_|\___\___|    \_/\_/ \___/|_|  |_|\_\___|_|           
                                                                                
if ("serviceWorker" in navigator) {
    const registration = navigator.serviceWorker.register("/sw.js")
}

//    ____   ___  ____ _____   ____                                                
//   / ___| / _ \|  _ \_   _| / ___|  ___ ___  _ __ ___                            
//   \___ \| | | | |_) || |   \___ \ / __/ _ \| '__/ _ \                           
//    ___) | |_| |  _ < | |    ___) | (_| (_) | | |  __/                           
//   |____/ \___/|_| \_\|_|   |____/ \___\___/|_|  \___|                           
                                                                                
window.addEventListener('load', async (e) => {
    try {
        const response = await fetch('/oplist.json')
        if (!response.ok) {
            throw new Error(`HTTP error while downloading operation list. Status: ${response.status}`)
        }
        window.procedures = await response.json()
        brightspot.postMessage({
            'type': 'data_in',
            'procedures': window.procedures,
        })
    } catch (error) {
        console.error('Error while downloading operation list:', error);
    }
})

let sortMainGroup = document.querySelector('#sort-maingroup')
let sortSubGroup = document.querySelector('#sort-subgroup')
let sortOperation = document.querySelector('#sort-operation')

sortMainGroup.addEventListener('change', (e) => {
    // filter operations
    let subGroups = window.procedures.filter((p) => {
        return p['MainGroup'] ==  e.target.value
    })
    subGroups = subGroups.map((g) => g['SubGroup'])
    subGroups = subGroups.sort()
    subGroups = new Set(subGroups)
    
    // reset sub-group
    sortSubGroup.innerHTML = ""

    // add non-option
    let nonOption = document.createElement('option')
    nonOption.value = ""
    nonOption.setAttribute('disabled', true)
    nonOption.setAttribute('selected', true)
    sortSubGroup.appendChild(nonOption)

    // render an <option> for each of the subgroups
    for (let g of subGroups) {
        let optionElement = document.createElement('option')
        optionElement.value = g
        optionElement.innerText = g
        sortSubGroup.appendChild(optionElement)
    }

    sortSubGroup.dispatchEvent(new Event('change'))
})

sortSubGroup.addEventListener('change', (e) => {
    // filter operations
    let operations = window.procedures.filter((p) => {
        return p['SubGroup'] ==  e.target.value
    })
    operations = operations.map((g) => g['SurgeryProcedure'])
    operations = operations.sort()
    operations = new Set(operations)
    
    // reset sub-group
    sortOperation.innerHTML = ""

    // add non-option
    let nonOption = document.createElement('option')
    nonOption.value = ""
    nonOption.setAttribute('disabled', true)
    nonOption.setAttribute('selected', true)
    sortOperation.appendChild(nonOption)

    // render an <option> for each of the operations
    for (let o of operations) {
        let optionElement = document.createElement('option')
        optionElement.value = o
        optionElement.innerText = o
        sortOperation.appendChild(optionElement)
    }
})

function calculateSortScore(data) {
    // requires: asa urgency tgv severity malignancy age
    // unless all keys are present, log error and return empty string
    let requiredKeys = ['asa', 'age', 'urgency', 'tgv', 'operation', 'malignancy']
    let hasRequiredKeys = requiredKeys.every((i) => { return data.hasOwnProperty(i) })
    if (hasRequiredKeys == false) {
        console.debug('SORT not calculated due to incomplete data:', data)
        return ""
    } else {
        console.info(`SORT Calculator ran with data: \n${JSON.stringify(data, space="    ")}`)
    }

    // get operation severity
    let operationData = window.procedures.filter((p) => { return p['SurgeryProcedure'] == data['operation'] })
    let severity = operationData[0]['SurgeryProcedureSeverity']

    let sortlogit = (
        (data['asa'] == "3") * 1.411 +
        (data['asa'] == "4") * 2.388 +
        (data['asa'] == "5") * 4.081 +
        (data['urgency'] == "Expedited") * 1.236 +
        (data['urgency'] == "Urgent") * 1.657 +
        (data['urgency'] == "Immediate") * 2.452 +
        (data['tgv'] == "Yes") * 0.712 +
        (["Xma", "Com"].includes(severity)) * 0.381 +
        (data['malignancy'] == "Yes") * 0.667 +
        (parseInt(data['age']) >= 65 && parseInt(data['age']) <= 79) * 0.777 +
        (parseInt(data['age']) >= 80) * 1.591 -
        7.366
    )

    // if (data['asa'] == "3") console.debug('asa 3 -> 1.411')
    // if (data['asa'] == "4") console.debug('asa 4 -> 2.388')
    // if (data['asa'] == "5") console.debug('asa 5 -> 4.081')
    // if (data['urgency'] == "Expedited") console.debug('expedited -> 1.236')
    // if (data['urgency'] == "Urgent") console.debug('urgent -> 1.657')
    // if (data['urgency'] == "Immediate") console.debug('immediate -> 2.452')
    // if (data['tgv'] == "Yes") console.debug('tgv -> 0.712')
    // if (["Xma", "Com"].includes(severity)) console.debug('xmaj/complex -> 0.381')
    // if (data['malignancy'] == "Yes") console.debug('malignancy -> 0.667')
    // if (parseInt(data['age']) >= 65 && parseInt(data['age']) <= 79) console.debug('age 65-79 -> 0.777')
    // if (parseInt(data['age']) >= 80) console.debug('age ≤ 80 -> 1.591')
    // console.debug('-7.366')

    let sortScore =  100 / (1 + Math.E**(0-sortlogit))

    return sortScore.toFixed(2)
}

let sortScoreOutput = document.querySelector('[clinic-parameter="sort-score"')
let sortContainer = document.querySelector('#sort-container')

sortContainer?.addEventListener('input', (e) => {
    let requiredData = {'asa': null, 'age': null, 'urgency': null, 'tgv': null, 'operation': null, 'malignancy': null}
    for (let k in requiredData) {
        let targetElement = sortContainer.querySelector(`[clinic-parameter="${k}"]`)
        let value = getAnyInputValue(targetElement)
        
        if (value != "") {
            requiredData[k] = value
        } else {
            sortScoreOutput.value = ""
            return
        }
    }

    setAnyInputValue(sortScoreOutput, calculateSortScore(requiredData))
    if (e.target != sortScoreOutput) {
        sortScoreOutput.dispatchEvent(new Event('input', {bubbles: true}))
    }
})

//    ____                   _                                                     
//   | __ )  ___  __ _  __ _| | ___     ***           ****                         
//   |  _ \ / _ \/ _` |/ _` | |/ _ \   *   ***********    *                        
//   | |_) |  __/ (_| | (_| | |  __/   ***               *                         
//   |____/ \___|\__,_|\__, |_|\___|  *    ***********    *                        
//                     |___/           ****           ****                         

let beagle = new Worker("/beagle.js")
let boneList = document.querySelector('#warnings')
let planInput = document.querySelector('[clinic-parameter="plan"]')
let boneInput = document.querySelector('[clinic-parameter="issues"]')

beagle.addEventListener('message', (m) => {
    // console.info(m.data['type'], m.data)
    
    // add bones
    if (m.data['type'] == 'beagle-bone-add') {
        
        if (m.data.name == "anonymous") return

        let toAdd = document.createElement('ul')
        toAdd.classList.add('pill-list')
        toAdd.setAttribute('beagle-bone-name', m.data.name)

        let firstPill = document.createElement('li')
        firstPill.classList.add('issue-pill')
        firstPill.innerHTML = `<span>${m.data.name}</span><button tabindex="1">Add</button>`
        firstPill.addEventListener('click', (e) => {
            e.target.closest('li').classList.add('added')
            boneInput.value = boneInput.value == "" ? `- ${m.data.name}` : `${boneInput.value}\n- ${m.data.name}`
            boneInput.dispatchEvent(new Event('input', {bubbles: true}))
        })

        toAdd.appendChild(firstPill)
        toAdd.insertAdjacentHTML('beforeend', '<ul class="pill-list"></ul>')


        boneList.insertAdjacentElement("afterbegin", toAdd)
    }
    
    // delete bones
    if (m.data['type'] == 'beagle-bone-delete') {
        let staleBone = document.querySelector(`[beagle-bone-name="${m.data.name}"]`)
        staleBone?.remove()
    }
    
    // add suggestions
    if (m.data['type'] == 'beagle-suggestion-add') {
        let targetList = document.querySelector(`ul[beagle-bone-name="${m.data.bone}"]`)?.querySelector('ul')
        let toAdd = document.createElement('li')
        toAdd.setAttribute('beagle-suggestion-name', m.data.suggestion)
        toAdd.setAttribute('clinic-text', m.data.suggestion)
        toAdd.innerHTML = `<span>${m.data.suggestion}</span><button tabindex="1">Add</button>`
        toAdd.addEventListener('click', (e) => {
            e.target.closest('li').classList.add('added')
            planInput.value = planInput.value == "" ? `- ${m.data.suggestion}` : `${planInput.value}\n- ${m.data.suggestion}`
            planInput.dispatchEvent(new Event('input', {bubbles: true}))
        })
        targetList.appendChild(toAdd)
    }
    
    // add suggestions
    if (m.data['type'] == 'beagle-suggestion-delete') {
        let staleSuggestion = document.querySelector(`[beagle-suggestion-name="${m.data.suggestion}"]`)
        staleSuggestion?.remove()
    }
})

// SUGGESTIONS BOXES

// let suggestionContainers = document.querySelectorAll('[clinic-suggestions-target]:not([clinic-suggestions-target=""])')
// for (let s of suggestionContainers) {
//     s.addEventListener('mousedown', (e) => { e.preventDefault() }) // prevent stealing focus
//     let suggestionTextInput = document.querySelector(`[clinic-parameter="${s.getAttribute('clinic-suggestions-target')}"]`)
//     s.addEventListener('click', (e) => {
//         let li = e.target.closest('li')
//         if (!li) return
//         li.classList.add('added')
//         suggestionTextInput.value = suggestionTextInput.value == "" ? `- ${li.getAttribute('clinic-text')}` : `${suggestionTextInput.value}\n- ${li.getAttribute('clinic-text')}`
//         suggestionTextInput.dispatchEvent(new Event('input', {bubbles: true}))
//     })
// }

//    ____                      _                                                  
//   / ___|  ___  __ _ _ __ ___| |__                                               
//   \___ \ / _ \/ _` | '__/ __| '_ \                                              
//    ___) |  __/ (_| | | | (__| | | |                                             
//   |____/ \___|\__,_|_|  \___|_| |_|                                             
                                                                                
let brightspot = new Worker('/brightspot.js')
let searchForm = document.querySelector('#smart-search')
let searchResults = document.querySelector('#smart-results')
searchForm.addEventListener('input', (e) => {
    e.preventDefault()
    let query = searchForm.querySelector('input[type="search"]')?.value
    if (!query) return
    brightspot.postMessage({
        'type': 'search',
        'query': query,
    })
})

brightspot.addEventListener('message', (m) => {
    let results = m.data

    if (results.length == 0) {
        searchResults.innerHTML = '<p style="text-align: center; font-weight: bold;">No results 🥺</p>'
        return
    }

    let newHTML = ''
    for (let r of results) {
        newHTML += `<li maingroup="${r.obj['MainGroup']}" subgroup="${r.obj['SubGroup']}"><span>${r.obj['SurgeryProcedure']}</span><button>Pick</button></li>\n`
    }
    searchResults.innerHTML = newHTML

    searchResults.firstChild.setAttribute('aria-selected', 'true')
})
searchResults.addEventListener('mousedown', (e) => {
    e.preventDefault() // stop focus stealing
})
searchResults.addEventListener('click', (e) => {
    let target = e.target.closest('li')
    if (!target) return

    let mainGroup = target.getAttribute('maingroup')
    let subGroup = target.getAttribute('subgroup')
    let operationName = target.querySelector('span')?.innerText

    if (!mainGroup || !subGroup || !operationName) return

    try {
        
        sortMainGroup.value = mainGroup
        sortMainGroup.dispatchEvent(new Event('change'))
        // debugger
        sortSubGroup.value = subGroup
        sortSubGroup.dispatchEvent(new Event('change'))
    
        sortOperation.value = operationName
        sortOperation.dispatchEvent(new Event('input', {bubbles: true}))

        sortMainGroup.focus()
    } catch (err) {
        console.error('failed to set operation using beagle result')
        console.error(err)
    }
})

//    / ___|___  _ __  ___  ___ _ __ | |_                                          
//   | |   / _ \| '_ \/ __|/ _ \ '_ \| __|                                         
//   | |__| (_) | | | \__ \  __/ | | | |_                                          
//    \____\___/|_| |_|___/\___|_| |_|\__|                                         
                                 

const consentSnippets = {
    'consent-ga': `Discussed risks and benefits of GA by prevalence.  

- VERY COMMON: sore throat (45% ETT, 20% LMA), PONV
- COMMON: minor lip/tongue injury (1 in 100)
- RARE: damage to teeth, severe allergy, nerve damage
- VERY RARE: awareness, death (1 in 100,000 ASA 1, 1 in 50,000 for all ASAs)

Specific risks including aspiration, LRTI, post op confusion, covert CVA with possible cognitive changes, temporary memory loss, myocardial infarction also discussed.`,
    'consent-sedation': `Consented for sedation, with risks discussed including death, failure, allergy, awareness, pain and need to progress to GA with its associated risks.`,
    'consent-regional': `Regional risks discussed - superficial skin infection, bleeding, nerve damage (parasthesia and/or paralysis), failure of block, damage to surrounding structures, adverse drug reactions.`,
    'consent-neuraxial': `Discussed risks and benefits of neuraxial anaesthesia. Specifically, nausea and vomiting, backache, headache, prolonged numbness or tingling, hypotension, urinary retention, nerve injury (1 in 500 temporary, ~1 in 25,000 permanent) and failure of regional technique.`,
    'consent-blood': `Consented to blood products.`,
    'consent-artline': `Consented to arterial line placement. Risks discussed include infection, bleeding, nerve damage (parasthesia and/or paralysis, damage to surrounding structures, adverse drug reactions, compartment syndrome, distal ischaemia.`,
    'consent-cvc': `Consented to central line placement. Risks discussed include infection, bleeding, arterial puncture, pneumothorax, thrombosis, air embolism, pain, vessel damage, arrhythmia.`,
}

//    _____                    _       _   _                                       
//   |_   _|__ _ __ ___  _ __ | | __ _| |_(_)_ __   __ _                           
//     | |/ _ \ '_ ` _ \| '_ \| |/ _` | __| | '_ \ / _` |                          
//     | |  __/ | | | | | |_) | | (_| | |_| | | | | (_| |                          
//     |_|\___|_| |_| |_| .__/|_|\__,_|\__|_|_| |_|\__, |                          
//                      |_|                        |___/                                     

let outputTemplates = {
'details': `# Patient Details
- Name: {{fullname}}
- UMRN: {{umrn}}
- Age: {{age}}
- Sex: {{sex}}
- Appointment type: {{mode}}
- Height: {{height}}
- Weight: {{weight}}
- BMI: {{bmi}}
- Operation: {{operation}}`,

'medicalhx': `# PMHx
{{pmhx}}

# Systems Review
- Recent illness: {{recently-ill}}
--> {{recently-ill-details}}
- METs: {{mets}}
- Able to lay flat: {{flat}}
- Exercise tolerance: {{mets-details}}
- Clinical frailty score: {{rockwood-cfs}}

# SHx
- Smoking: {{smoking}}
--> {{smoking-details}}
- etOH: {{etoh}}
- Illicit drugs: {{drugs}}
- Occupation: {{occupation}}
- Functional status: {{functional-status}}
{{shx}}`,

'rx': `# Medications
{{rx}}

# Supplements
{{herbs}}

# Allergies
{{allergies}}`,

'gashx': `# Previous Anaesthesia
{{pahx}}

## Anaesthesia Summary
- BVM: {{bvm}}
- LMA: {{lma}}
- ETT: {{ett}}
- Agents used: {{agents}}
- Haemodynamics: {{haemodynamics}}
- Complications: {{gas-issues}}

# Airway Assessment
- Dentition: {{teeth}}
- Mallampati: {{mallampati}}
- Mouth opening: {{mouth-opening}} cm
- Thyromental distance: {{tmd}} cm
- Cricothyroid: {{cricothyroid}}
- Neck ROM: {{neckrom}}
- Bearded: {{beard}}
- Jaw protrusion: {{jaw-protrusion}}
- Vein quality: {{veins}}

# Other Findings
- Heart sounds: {{heart}}
- Lung sounds: {{lung}}
{{other-examination}}

{{mode}}`,

'ix': `# Investigations
- Source: {{bloods-source}}
- FBC: {{fbc}}
- UEC: {{uec}}
- LFT: {{lft}}
- HbA1c: {{hba1c}}%
- Iron studies: {{iron}}
- Coags: {{coags}}
- ECG: {{ecg}}
{{other-ix}}`,

'consent': `# Informed Consent
{{consent-output}}

# Special Notes
{{consent-notes}}`,

'risk': `# Risk Assessment
- ASA: {{asa}}
- STOP-BANG: {{stopbang-score}}/8
--> {{stopbang-interpretation}}
- Apfel: {{apfel-score}}/4
--> {{apfel-interpretation}}
- RCRI: {{rcri-score}}/6
--> {{rcri-interpretation}}
- SORT
--> {{sort-score}}% 30-day mortality`,

'plan': `# Key Issues
{{issues}}

# Anaesthetic Plan
{{plan}}

# Medications and Fasting
{{medication}}`
}

function getAnyInputValue(inputElement) {
    if (inputElement.tagName == 'select' && inputElement.selectedIndex > 0) {
        return inputElement.value
    } else if (inputElement.tagName == 'INPUT' && inputElement.getAttribute('type') == 'checkbox') {
        return inputElement.checked
    } else if (inputElement.tagName == 'P' || inputElement.tagName == 'SPAN') {
        return inputElement.innerText
    } else {
        return inputElement.value
    }
}

function setAnyInputValue(inputElement, value) {
    if (inputElement.tagName == 'select' && inputElement.selectedIndex > 0) {
        inputElement.value = value
    } else if (inputElement.tagName == 'INPUT' && inputElement.getAttribute('type') == 'checkbox') {
        inputElement.checked = value
    } else if (inputElement.tagName == 'P' || inputElement.tagName == 'SPAN') {
        inputElement.innerText = value
    } else {
        inputElement.value = value
    }
}

// RENDER
function getRenderedSection(id) {
    let template = outputTemplates[id]

    // get consent if needed
    if (id == 'consent') {
        let consentSwitches = document.querySelectorAll('section#consent input[type="checkbox"]')
        let consent = ''
        for (let s of consentSwitches) {
            if (s.checked == true) {
                let consentType = s.getAttribute('clinic-parameter')
                let consentSnippet = consentSnippets[consentType]
                consent += consentSnippet
                consent += '\n\n'
            }
        }
        consent = consent.trim()
        template = template.replace('{{consent-output}}', consent)
    }

    if (id == 'medicalhx') {
        let output = ""

        for (let d of document.querySelectorAll('clinic-diagnosis')) {
            // if (!getAnyInputValue(d)) continue

            output += d.renderText()
            output += '\n'
        }

        output = output.trim()

        template = template.replace('{{pmhx}}', output)
    }

    // replace known values
    for (let c of template.matchAll(/\{\{(.*?)\}\}/gmi)) {
        let stringToReplace = c[0]
        let dataKey = c[1]
        let dataValue = persistentDataProxy[dataKey]
        if (!dataValue) continue
        template = template.replace(stringToReplace, dataValue)
    }

    // delete lines containing unreplaced values
    for (let l of template.matchAll(/^.*({{.*?}}).*$\n?/gm)) {
        template = template.replace(l[0], '')
    }

    // remove ## headers with nothing under them
    for (let h of template.matchAll(/^#* .+(?=\n*$)(?!\n[^#\s])\n*/gm)) {
        template = template.replace(h[0], '')
    }
    
    return template
}

//     ____      _            _       _                                            
//    / ___|__ _| | ___ _   _| | __ _| |_ ___  _ __ ___                            
//   | |   / _` | |/ __| | | | |/ _` | __/ _ \| '__/ __|                           
//   | |__| (_| | | (__| |_| | | (_| | || (_) | |  \__ \                           
//    \____\__,_|_|\___|\__,_|_|\__,_|\__\___/|_|  |___/                           
   
let scoreInterpretationFunctions = {
    'apfel': (score) => {
        let risk
        if (score == 0) risk = '10'
        if (score == 1) risk = '21'
        if (score == 2) risk = '39'
        if (score == 3) risk = '61'
        if (score == 4) risk = '79'
        return `${risk}% 24-hour PONV risk`
    },
    'rcri': (score) => {
        let risk
        if (score == 0) risk = '3.9'
        if (score == 1) risk = '6.0'
        if (score == 2) risk = '10.1'
        if (score >= 3) risk = '15'
        return `${risk}% 30-day MACE risk`
    },
    'stopbang': (score) => {
        let risk
        if (score >= 0 && score <=2) risk = 'Low'
        if (score >= 3 && score <=4) risk = 'Intermediate'
        if (score >= 5) risk = 'High'
        return `${risk} OSA risk`
    },
}

let allCalculators = document.querySelectorAll('[clinic-calculator]')
for (let c of allCalculators) {
    // set up element handles
    c.checkboxes = c.querySelectorAll('input[type="checkbox"]')
    c.output = c.querySelector('[clinic-calculator-output]')
    c.interpretation = c.querySelector('[clinic-calculator-interpretation]')

    // find interpreter
    let interpreter = c.getAttribute('clinic-interpreter') || false
    if (interpreter && Object.keys(scoreInterpretationFunctions).includes(interpreter)) {
        c.interpreter = scoreInterpretationFunctions[interpreter]
    }

    // update score and interpretation on input
    c.addEventListener('input', (e) => {
        // prevent autophagy
        if (e.target.matches('[clinic-calculator-output]')) return

        // get score
        let score = 0
        for (let b of c.checkboxes) {
            score += b.checked ? 1 : 0
        }

        // save score
        if (c.output) {
            setAnyInputValue(c.output, score)
            if (e.target != c.output) {
                c.output.dispatchEvent(new Event('input', {bubbles: true}))
            }
        }

        // get interpretation
        if (c.interpreter && c.interpretation) {
            setAnyInputValue(c.interpretation, c.interpreter(score))
            if (e.target != c.interpretation) {
                c.interpretation.dispatchEvent(new Event('input', {bubbles: true}))
            }
        }
    })
}

//    _____         _     _____    _ _ _   _                                       
//   |_   _|____  _| |_  | ____|__| (_) |_(_)_ __   __ _                           
//     | |/ _ \ \/ / __| |  _| / _` | | __| | '_ \ / _` |                          
//     | |  __/>  <| |_  | |__| (_| | | |_| | | | | (_| |                          
//     |_|\___/_/\_\\__| |_____\__,_|_|\__|_|_| |_|\__, |                          
//                                                 |___/                           

// AUTO DOT POINTS
let validDotPoints = ['- ', '--> ']
document.body.addEventListener('keydown', (e) => {
    if (!e.target.matches('textarea.bigbox')) return

    if (e.key == "Enter") {
        let textarea = e.target
        let cursorPosition = textarea.selectionStart
        let currentLine = textarea.value.substring(0, cursorPosition).split('\n').pop().trim()
        let dotPoint
        for (let d of validDotPoints) {
            if (currentLine.startsWith(d)) {
                dotPoint = d
                break
            }
        }
    
        if (dotPoint) {
            let newLineText = `\n${dotPoint}`
            textarea.value = textarea.value.substring(0, cursorPosition) + newLineText + textarea.value.substring(cursorPosition)
            textarea.selectionStart = cursorPosition + newLineText.length
            textarea.selectionEnd = cursorPosition + newLineText.length
            textarea.closest('section')?.dispatchEvent(new Event('input'))
            e.preventDefault()
        }
    }

})

//    ____                  _       _    ____                                      
//   / ___| _ __   ___  ___(_) __ _| |  / ___|__ _ ___  ___  ___                   
//   \___ \| '_ \ / _ \/ __| |/ _` | | | |   / _` / __|/ _ \/ __|                  
//    ___) | |_) |  __/ (__| | (_| | | | |__| (_| \__ \  __/\__ \                  
//   |____/| .__/ \___|\___|_|\__,_|_|  \____\__,_|___/\___||___/                  
//         |_|                                                                     

// BMI CALCULATOR
let weightInput = document.querySelector('#weight')
let heightInput = document.querySelector('#height')
let bmiOutput = document.querySelector('#bmi')
for (let i of [weightInput, heightInput]) {
    i.addEventListener('input', (e) => {
        let w = parseInt(weightInput.value)
        let h = parseInt(heightInput.value)

        let output
        if (w == undefined || h == undefined) {
            output = ''
        } else {
            output = w / (h/100)**2
        }

        if (isNaN(output) == false) {
            bmiOutput.value = output.toFixed(1)
        } else {
            bmiOutput.value = ''
        }

        // dispatch event to prompt saving to localStorage
        // bubbles because the relevant event listener is attached to the parent <section>, not the <input>
        bmiOutput.dispatchEvent(new Event('input', { bubbles: true }))
    })
}

// BMI -> stopbang
let stopBangBMI = document.querySelector('#stopbang-bmi')
// let osmrsBMI = document.querySelector('[clinic-parameter="osmrs-bmi"]')
bmiOutput.addEventListener('input', (e) => {
    let bmi = parseFloat(e.target.value)
    if (bmi > 35) {
        stopBangBMI.checked = true
    } else {
        stopBangBMI.checked = false
    }

    // if (bmi >= 50) {
    //     osmrsBMI.checked = true
    // } else {
    //     osmrsBMI.checked = false
    // }

    stopBangBMI.dispatchEvent(new Event('input', {'bubbles': true}))
    // osmrsBMI.dispatchEvent(new Event('input', {'bubbles': true}))
})

// SEX -> apfel, stopbang
let sexInput = document.querySelector('#anthropometry-sex')
let apfelSexOutput = document.querySelector('#apfel-sex')
let stopbangSexOutput = document.querySelector('#stopbang-sex')
// let osmrsSex = document.querySelector('[clinic-parameter="osmrs-sex"]')
sexInput.addEventListener('input', (e) => {
    if (sexInput.value == 'M') {
        apfelSexOutput.checked = false
        stopbangSexOutput.checked = true
        // osmrsSex.checked = true
    } else {
        apfelSexOutput.checked = true
        stopbangSexOutput.checked = false
        // osmrsSex.checked = false
    }
    apfelSexOutput.dispatchEvent(new Event('input', {'bubbles': true}))
    stopbangSexOutput.dispatchEvent(new Event('input', {'bubbles': true}))
    // osmrsSex.dispatchEvent(new Event('input', {'bubbles': true}))
})

// AGE -> stopbang, sort
let ageInput = document.querySelector('[clinic-parameter="age"]')
let stopbangAgeOutput = document.querySelector('#stopbang-age')
let sortAgeOutput = document.querySelector('#sort-age')
// let osmrsAge = document.querySelector('[clinic-parameter="osmrs-age"]')
ageInput.addEventListener('input', (e) => {
    let age = e.target.value

    if (age > 50) {
        stopbangAgeOutput.checked = true
    } else {
        stopbangAgeOutput.checked = false
    }
    stopbangAgeOutput.dispatchEvent(new Event('input', {'bubbles': true}))

    // if (age >= 45) {
    //     osmrsAge.checked = true
    // } else {
    //     osmrsAge.checked = false
    // }
    // osmrsAge.dispatchEvent(new Event('input', {'bubbles': true}))


})

// SMOKING -> apfel
let smokingInput = document.querySelector('[clinic-parameter="smoking"')
let apfelSmokingOutput = document.querySelector('#apfel-smoking')
smokingInput.addEventListener('input', (e) => {
    if (e.target.value != 'active smoker') {
        apfelSmokingOutput.checked = true
    } else {
        apfelSmokingOutput.checked = false
    }
})



// let allSections = document.querySelectorAll('section')
// for (let s of allSections) {
//     s.dispatchEvent(new Event('input'))
// }

//    ____                                                                         
//   / ___| _   _ _ __   ___                                                       
//   \___ \| | | | '_ \ / __|                                                      
//    ___) | |_| | | | | (__                                                       
//   |____/ \__, |_| |_|\___|                                                      
//          |___/                                                                  

document.body.addEventListener('input', (e) => {
    if (!e.target.hasAttribute('clinic-sync')) return

    let syncAttribute = e.target.getAttribute('clinic-sync')
    let syncValue = getAnyInputValue(e.target)
    let syncTargets = document.querySelectorAll(`[clinic-sync="${syncAttribute}"]`)
    for (let t of syncTargets) {
        if (t == e.target) continue
        setAnyInputValue(t, syncValue)
        t.dispatchEvent(new Event('input'))
    }
})

//    ____                      _                 _                                
//   |  _ \  _____      ___ __ | | ___   __ _  __| | ___ _ __                      
//   | | | |/ _ \ \ /\ / / '_ \| |/ _ \ / _` |/ _` |/ _ \ '__|                     
//   | |_| | (_) \ V  V /| | | | | (_) | (_| | (_| |  __/ |                        
//   |____/ \___/ \_/\_/ |_| |_|_|\___/ \__,_|\__,_|\___|_|                        

function downloadDocument() {
    // JS really needs better date string formatting tools
    let today = new Date()
    let year = today.getFullYear()
    let month = String(today.getMonth() + 1).padStart(2, '0')
    let day = String(today.getDate()).padStart(2, '0')
    let formattedDate = `${year}-${month}-${day}`

    // Fabricate a filename (date + UMRN)
    let filename = `${formattedDate} ${document.querySelector('#umrn')?.value || 'Clinic Patient'}.txt`

    // Create a text dump
    let textDump = ''
    for (let s of document.querySelectorAll('section')) {
        let renderedTemplate = getRenderedSection(s.id)
        textDump += renderedTemplate + '\n\n'
    }

    // Create sham download link
	let downloadLink = document.createElement('a')
	downloadLink.setAttribute('href','data:text/plain;charset=utf-8,' + encodeURIComponent(textDump))
    downloadLink.setAttribute('download', filename)
	downloadLink.style.display = "none"
	document.body.appendChild(downloadLink)

    // Pull the lever, Kronk
	downloadLink.click()
}

document.querySelector('#download')?.addEventListener('click', (e) => {
    downloadDocument()
})

// RESET
document.querySelector('#reset')?.addEventListener('click', (e) => {
    if (confirm('Are you sure you want to reset the page?')) {
        downloadDocument()
        localStorage.setItem('clinic-data', '{}')
        window.location.reload()
    }
})

//    _____         _     _____                            _                       
//   |_   _|____  _| |_  | ____|_  ___ __   __ _ _ __   __| | ___ _ __             
//     | |/ _ \ \/ / __| |  _| \ \/ / '_ \ / _` | '_ \ / _` |/ _ \ '__|            
//     | |  __/>  <| |_  | |___ >  <| |_) | (_| | | | | (_| |  __/ |               
//     |_|\___/_/\_\\__| |_____/_/\_\ .__/ \__,_|_| |_|\__,_|\___|_|               
//                                  |_|                                            

let shortcuts = [
    { shortcut: '!rx', expansion: 'Withhold mediations as per pharmacy letter' },
    { shortcut: '!rf', expansion: 'Routine fasting advice provided' },
    { shortcut: '!htn', expansion: 'Hypertension' },
    { shortcut: '!lip', expansion: 'Dyslipidaemia' },
    { shortcut: '!end', expansion: '- Routine fasting advice provided\n- Withhold mediations as per pharmacy letter' },
    { shortcut: '!ok', expansion: 'no issues with anaesthesia (PONV, FHx, airway disater, unplanned ICU admission, etc.)'}
]

document.body.addEventListener('input', (e) => {
    if (e.target.matches('textarea, input')) {
        let target = e.target
        let initialCursorPosition = target.selectionStart
        let precedingText = target.value.slice(0, initialCursorPosition)

        for (let s of shortcuts) {
            let shortcut = s['shortcut']
            if (precedingText.endsWith(shortcut)) {
                // get expansion
                let expansion = s['expansion']
                // manufacture new string
                let newText = target.value.slice(0, initialCursorPosition - shortcut.length) + expansion + target.value.slice(initialCursorPosition)
                // replace old string
                target.value = newText
                // fire input event
                target.closest('section')?.dispatchEvent(new Event('input'))
                // fix cursor position
                let newCursorPosition = initialCursorPosition - shortcut.length + expansion.length
                target.setSelectionRange(newCursorPosition, newCursorPosition)
            }
        }
    }
})

//   __        __   _                            _____         _                   
//   \ \      / /__| | ___ ___  _ __ ___   ___  |_   _|____  _| |_                 
//    \ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \   | |/ _ \ \/ / __|                
//     \ V  V /  __/ | (_| (_) | | | | | |  __/   | |  __/>  <| |_                 
//      \_/\_/ \___|_|\___\___/|_| |_| |_|\___|   |_|\___/_/\_\\__|                
                                                                                
let welcomeDialog = document.querySelector('#big-welcome')
window.addEventListener('load', (e) => {
    let todayDate = new Date().toISOString().slice(0,10)
    let storedDate = localStorage.getItem('clinic-last-welcome-date') || ''
    if (todayDate != storedDate) {
        welcomeDialog.showModal()
    }
    localStorage.setItem('clinic-last-welcome-date', todayDate)
})

//     ___        _      _           _       _     _                               
//    / _ \ _   _(_) ___| | __      / \   __| | __| |                              
//   | | | | | | | |/ __| |/ /____ / _ \ / _` |/ _` |                              
//   | |_| | |_| | | (__|   <_____/ ___ \ (_| | (_| |                              
//    \__\_\\__,_|_|\___|_|\_\   /_/   \_\__,_|\__,_|                              
        
let quickAddDialog = document.querySelector('#quick-add')
document.addEventListener("keydown", (e) => {
	let key = e.key.toLowerCase()
    if (key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        quickAddDialog.showModal()

    }
    if (key === "enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        document.querySelector('dialog[open]').close()
    }
})
quickAddDialog.addEventListener('keydown', (e) => {
    if (e.key == "Tab") {
        e.preventDefault()
        quickAddDialog.querySelector('textarea:not(:focus)')?.focus()
    }
})

//     ____ __  __ ____        _  __                                               
//    / ___|  \/  |  _ \      | |/ /                                               
//   | |   | |\/| | | | |_____| ' /                                                
//   | |___| |  | | |_| |_____| . \                                                
//    \____|_|  |_|____/      |_|\_\                                               

window.addEventListener('DOMContentLoaded', (e) => {
    let allInputs = document.querySelectorAll('[clinic-search]')
    document.allInputs = []
    for (let i of allInputs) {
        document.allInputs.push({
            'name': i.getAttribute('clinic-search') || 'Unknown Parameter',
            'element': i,
        })
    }
})

let quickFindDialog = document.querySelector('#quick-find')
let quickFindSearch = document.querySelector('#quick-find-input')
let quickFindResults = document.querySelector('#quick-find-results')
document.addEventListener("keydown", (e) => {
	let key = e.key.toLowerCase()
    if ((key === "k" && (e.metaKey || e.ctrlKey)) || key == "esc") {
        e.preventDefault()
        quickFindDialog.showModal()
    }
})
quickFindSearch.addEventListener('input', (e) => {
    let results = fuzzysort.go(e.target.value, document.allInputs, {key: 'name', limit: 5})
    quickFindResults.innerHTML = ''
    for (let r of results) {
        let li = document.createElement('li')
        li.innerHTML = `${r.obj['name']}<button tabindex="2">Go</button>`
        li.onclick = (e) => {
            // scroll into view and focus
            // setTimeout() seems to be required here
            r.obj['element'].scrollIntoView({ block: "center", inline: "nearest"})
            setTimeout(() => { r.obj['element'].focus() }, 0)
            // be gone
            quickFindDialog.close()
            // reset
            quickFindSearch.value = ''
            quickFindResults.innerHTML = ''
        }
        quickFindResults.appendChild(li)
        quickFindResults.firstChild.setAttribute('aria-selected', 'true')
    }
})


customElements.define('clinic-searchresults', class extends HTMLElement {
    constructor () {
        super()
        this.resultsSelector = this.getAttribute('results') || 'ul'
        this.resultsContainer = this.querySelector(this.resultsSelector)

        this.searchSelector = this.getAttribute('search') || 'input[type="search"]'
        this.searchContainer = this.querySelector(this.searchSelector)

        
        this.addEventListener("keydown", (e) => {
            // ENTER
            if (e.key == "Enter") {
                this.resultsContainer.querySelector('[aria-selected]')?.click()
            }

            // DOWN
            if (e.key == "ArrowDown") {
                e.preventDefault()
                let currentlySelected = this.resultsContainer.querySelector('[aria-selected]')
                let nextElement = currentlySelected?.nextElementSibling
                currentlySelected.removeAttribute('aria-selected')
                if (nextElement) {
                    // go to next
                    nextElement.setAttribute('aria-selected', 'true')
                } else {
                    // go to top
                    this.resultsContainer.firstElementChild.setAttribute('aria-selected', 'true')
                }
            }

            // UP
            if (e.key == "ArrowUp") {
                e.preventDefault()
                let currentlySelected = this.resultsContainer.querySelector('[aria-selected]')
                let previousElement = currentlySelected?.previousElementSibling
                currentlySelected.removeAttribute('aria-selected')
                if (previousElement) {
                    // go to next
                    previousElement.setAttribute('aria-selected', 'true')
                } else {
                    // go to top
                    this.resultsContainer.lastElementChild.setAttribute('aria-selected', 'true')
                }
            }
        })
    }
})

//    ____  _                _             _                                       
//   / ___|| |__   ___  _ __| |_ ___ _   _| |_ ___                                 
//   \___ \| '_ \ / _ \| '__| __/ __| | | | __/ __|                                
//    ___) | | | | (_) | |  | || (__| |_| | |_\__ \                                
//   |____/|_| |_|\___/|_|   \__\___|\__,_|\__|___/                                
                                                                                
let shortcutsMenu = document.querySelector('#shortcuts-menu')
shortcutsMenu?.addEventListener('change', (e) => {
    let option = e.target.options[e.target.selectedIndex]
    option.click()
    e.target.value = 'initial'
})

document.querySelector('#quick-find-button')?.addEventListener('click', (e) => {
    quickFindDialog.showModal()
})
document.querySelector('#quick-add-button')?.addEventListener('click', (e) => {
    quickAddDialog.showModal()
})

//    ____                 _ _                                                     
//   / ___|  ___ _ __ ___ | | |___ _ __  _   _                                     
//   \___ \ / __| '__/ _ \| | / __| '_ \| | | |                                    
//    ___) | (__| | | (_) | | \__ \ |_) | |_| |                                    
//   |____/ \___|_|  \___/|_|_|___/ .__/ \__, |                                    
//                                |_|    |___/                                     

document.body.addEventListener('click', (e) => {
    // any click on a tab selector should open that tab
    // adding a 'click' event listener to the li itself doesn't pick up click that landed on text or icons
    // hence the fancy selector
    if (e.target.matches('#tab-picker li[scroll-target], #tab-picker li[scroll-target] *')) {
        // find target <section>
        let id = e.target.closest('li').getAttribute('scroll-target')
        let targetElement = document.querySelector(`#${id}`)

        // die if element doesn't exist
        if (!targetElement) {
            console.error(`tab-picker clicked but its target doesn't exist (ID: ${id})`, e.target.closest('li'))
            return
        }

        // move focus to first input
        let firstInput = targetElement.querySelector('input, textarea')
        firstInput?.focus()

        // scroll into view
        targetElement.scrollIntoView({behavior: "instant", block: "center"})
        document.dispatchEvent(new Event('scroll'))
    }

    // any clicks on a <section> that don't land on something focus-able should put focus the first input
    // if (e.target.matches('section, section *:not(:focus, button.section-copy)')) {
    //     e.target?.closest('section')?.querySelector('input, select, textarea, label')?.focus({preventScroll: true})
    // }
})

document.addEventListener('mousedown', (e) => {
    if (e.target.matches('div.section-topper, div.section-topper *')) {
        // prevent stealing focus
        e.preventDefault()
        
        // copy contents
        let output = getRenderedSection(e.target.closest('section').id)
        navigator.clipboard.writeText(output.trim())
    }
})

let allTabs = document.querySelectorAll('#tab-picker li[scroll-target]')
let allSections = document.querySelectorAll('section')

document.addEventListener('scroll', (e) => {
    scrollSpyHandler()
})
document.addEventListener('focusin', (e) => {
    scrollSpyHandler()
})

function scrollSpyHandler() {
    let currentScrollPosition = window.scrollY

    // highlight section:focus-within if it's inside the viewport anywhere
    let sectionsWithFocus = document.querySelectorAll('section:focus-within')
    for (let swf of sectionsWithFocus) {
        if (swf.offsetTop >= currentScrollPosition && swf.offsetTop + swf.offsetHeight <= currentScrollPosition + window.innerHeight) {
            setScrollSpySelection(swf.id)
            return
        }
    }

    // highlight final section if scrolled within 30px of the bottom
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 30) {
        let id = Array.from(allSections)?.at(-1)?.id
        setScrollSpySelection(id)
        return
    }

    // otherwise highlight topmost element whose top edge is within the viewport
    for (let s of allSections) {
        let offsetTop = s.offsetTop
        let height = s.offsetHeight
        let id = s.id

        if ((s.offsetTop + 30) >= currentScrollPosition) {
            setScrollSpySelection(id)
            return
        }
    }
}

document.dispatchEvent(new Event('scroll'))

function setScrollSpySelection(id) {
    let buttonToHighlight = document.querySelector(`li[scroll-target="${id}"]`)
    if (!buttonToHighlight) return
    for (let t of allTabs) {
        t.removeAttribute('aria-selected')
    }
    buttonToHighlight.setAttribute('aria-selected', true)

}

//    _   _ _     _             _                                                  
//   | | | (_)___| |_ ___  _ __(_) __ _ _ __                                       
//   | |_| | / __| __/ _ \| '__| |/ _` | '_ \                                      
//   |  _  | \__ \ || (_) | |  | | (_| | | | |                                     
//   |_| |_|_|___/\__\___/|_|  |_|\__,_|_| |_|                                     
                                                  
let diagnosisList = document.querySelector('#diagnosis-list')
let diagnosisSearchBox = document.querySelector('#diagnosis-search input')
let diagnosisSearchResultsList = document.querySelector('#diagnosis-results ul')
let allDiagnoses = [
    {
        matchable_string: "T2DM type two 2 II insulin dependent diabetes mellitus IDDM",
        name: "T2DM",
        id: "diagnosis-t2dm",
        html: `
            <div class="hstack">
                <label>
                    Hypoglycaemia Aware
                    <div class="selectbox">
                        <select diagnosis-parameter="Hypoglycaemia awareness">
                            <option value="" selected></option>
                            <option value="intact">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    HbA1c
                    <input type="number" diagnosis-parameter="HbA1c" clinic-sync="hba1c">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Insulin Dependent
                    <div class="selectbox">
                        <select diagnosis-parameter="Insulin dependent">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    "Brittle" Disease
                    <div class="selectbox">
                        <select diagnosis-parameter="Brittle disease">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <label>
                Microvascular Complications
                <input type="text" diagnosis-parameter="Microvascular complications">
            </label>
            <label>
                Macrovascular Complications
                <input type="text" diagnosis-parameter="Macrovascular complications">
            </label>`
    },
    {
        matchable_string: "T1DM type one 1 I diabetes mellitus",
        name: "T1DM",
        id: "diagnosis-t1dm",
        html: `
            <div class="hstack">
                <label>
                    Year Diagnosed
                    <input type="text" diagnosis-parameter="Year diagnosed">
                </label>
                <label>
                    HbA1c
                    <input type="number" diagnosis-parameter="HbA1c" clinic-sync="hba1c">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Hypoglycaemia Aware
                    <div class="selectbox">
                        <select diagnosis-parameter="Hypoglycaemia awareness">
                            <option value="" selected></option>
                            <option value="intact">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    "Brittle" Disease
                    <div class="selectbox">
                        <select diagnosis-parameter="Brittle disease">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <label>
                Microvascular Complications
                <input type="text" diagnosis-parameter="Microvascular complications">
            </label>
            <label>
                Microvascular Complications
                <input type="text" diagnosis-parameter="Macrovascular complications">
            </label>`
    },
    {
        matchable_string: "HF HFpEF HFrEF congestive cardiac heart failure",
        name: "Heart Failure",
        id: "diagnosis-ccf",
        html: `
            <div class="hstack">
                <label>
                    NYHA
                    <div class="selectbox">
                        <select diagnosis-parameter="NYHA">
                            <option value="" selected></option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                    </div>
                </label>
                <label>
                    Aetiology
                    <input type="text" diagnosis-parameter="Aetiology">
                </label>
            </div>`
    },
    {
        matchable_string: "essential hypertension htn",
        name: "Hypertension",
        id: "diagnosis-hypertension",
        html: `
            <div class="hstack">
                <label>
                    Baseline BP
                    <input type="text" diagnosis-parameter="Baseline BP">
                </label>
                <label>
                    End Organ Damage
                    <div class="selectbox">
                        <select diagnosis-parameter="End-organ damage">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "dyslipiaemia hyperlipidaemia hypercholesterolaemia",
        name: "Dyslipidaemia",
        id: "diagnosis-dyslipidaemia",
        html: ``
    },
    {
        matchable_string: "depression",
        name: "Depression",
        id: "diagnosis-depression",
        html: ``
    },
    {
        matchable_string: "social anxiety gad",
        name: "Anxiety",
        id: "diagnosis-anxiety",
        html: ``
    },
    {
        matchable_string: "rheumatoid arthritis",
        name: "Rheumatoid Arthritis",
        id: "diagnosis-rheumatoid-arthritis",
        html: `
            <div class="hstack">
                <label>
                    C-Spine Involvement
                    <div class="selectbox">
                        <select diagnosis-parameter="C-Spine involvement">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Immune Suppressed
                    <div class="selectbox">
                        <select diagnosis-parameter="Immune suppressed">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "chronic obstructive pulmonary airways disease",
        name: "COPD",
        id: "diagnosis-copd",
        html: `
            <div class="hstack">
                <label>
                    GOLD Class
                    <div class="selectbox">
                        <select diagnosis-parameter="GOLD classification">
                            <option value="" selected></option>
                            <option value="mild (FEV1 ≥ 80% predicted)">Mild – FEV1 ≥ 80% predicted</option>
                            <option value="moderate (FEV1 50-79% predicted)">Moderate – FEV1 50-79% predicted</option>
                            <option value="severe (FEV1 &lt; 49% predicted)">Severe – FEV1 &lt; 49% predicted</option>
                            <option value="very severe (FEV1 &lt; 30% predicted)">Very severe – FEV1 &lt; 30% predicted</option>
                        </select>
                    </div>
                </label>
                <label>
                    Smoking
                    <div class="selectbox">
                        <select diagnosis-parameter="Smoking" clinic-sync="smoking" autocomplete="off">
                            <option value="" selected></option>
                            <option value="active smoker">Active smoker</option>
                            <option value="ex-smoker">Ex-smoker</option>
                            <option value="never smoked">Never smoked</option>
                        </select>
                    </div>
                </label>
            </div>
            <div class="hstack">
                <label>
                    pHTN or RV Failure
                    <div class="selectbox">
                        <select diagnosis-parameter="PHTN/RV failure" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    <span>Home <span>O<sub>2</sub></span>
                    <div class="selectbox">
                        <select diagnosis-parameter="Home O2" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <label>
                mMRC Dyspnoea Scale
                <div class="selectbox">
                    <select diagnosis-parameter="mMRC dyspnoea" autocomplete="off">
                        <option value="" selected></option>
                        <option value="0">0 – Dyspnea only with strenuous exercise</option>
                        <option value="1">1 – Dyspnea when hurrying or walking up a slight hill</option>
                        <option value="2">2 – Walks slower than people of the same age because of dyspnea or has to stop for breath when walking at own pace</option>
                        <option value="3">3 – Stops for breath after walking 100 yards (91 m) or after a few minutes</option>
                        <option value="4">4 – Too dyspneic to leave house or breathless when dressing</option>
                    </select>
                </div>
            </label>
            <label>
                Recent Exacerbations
                <input type="text" diagnosis-parameter="Recent exacerbations">
            </label>
            `
    },
    {
        matchable_string: "asthma",
        name: "Asthma",
        id: "diagnosis-asthma",
        html: `
            <div class="hstack">
                <label>
                    NSAID Reactive
                    <div class="selectbox">
                        <select diagnosis-parameter="NSAID reactive">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Hospital/ICU Admissions
                    <div class="selectbox">
                        <select diagnosis-parameter="Hospital/ICU admissions">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <hr>
            <span>In the past <b>four weeks</b>, has the patient had:</span>
            <div class="hstack">
                <label>
                    Day Symptoms
                    <div class="selectbox">
                        <select diagnosis-parameter="Daytime symptoms">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Night Symptoms
                    <div class="selectbox">
                        <select diagnosis-parameter="Night symptoms">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <div class="hstack">
                <label>
                    Used SABA ≥ 2x Weekly
                    <div class="selectbox">
                        <select diagnosis-parameter="Heavy reliever use">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Activity Limitation
                    <div class="selectbox">
                        <select diagnosis-parameter="Activity limitation">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <hr>`
    },
    {
        matchable_string: "AS aortic stenosis",
        name: "Aortic Stenosis",
        id: "diagnosis-aortic-stenosis",
        html: `
            <label>
                Radiographic Severity
                <input type="text" diagnosis-parameter="Radiographic severity">
            </label>
            <label>
                Symptom Burden
                <input type="text" diagnosis-parameter="Symptoms">
            </label>`
    },
    {
        matchable_string: "AF atrial fibrillation",
        name: "Atrial Fibrillation",
        id: "diagnosis-atrial-fibrillation",
        html: `
            <div class="hstack">
                <label>
                    Type
                    <div class="selectbox">
                        <select diagnosis-parameter="Type" autocomplete="off">
                            <option value="" selected></option>
                            <option value="paroxysmal">Paroxysmal (≥ 7 days)</option>
                            <option value="persistent">Persistent (≥ 7 days)</option>
                            <option value="longstanding">Longstanding (≥ 1 year)</option>
                            <option value="permanent">Permanent (cardioversion-resistant)</option>
                        </select>
                    </div>
                </label>
                <label>
                    <span>CHA<sub>2</sub>DS<sub>2</sub>-VASc</span>
                    <input type="number" step="1" min="0" max="8" diagnosis-parameter="CHADS-VASc">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Rate Control
                    <input type="text" step="1" min="0" max="8" diagnosis-parameter="Rate control">
                </label>
                <label>
                    Rhythm Control
                    <input type="text" step="1" min="0" max="8" diagnosis-parameter="Rhythm control">
                </label>
            </div>
            <label>
                Anticoagulated
                <div class="selectbox">
                    <select diagnosis-parameter="Anticoagulated" autocomplete="off">
                        <option value="" selected></option>
                        <option value="YES">Yes</option>
                        <option value="no">No</option>
                    </select>
                </div>
            </label>`
    },
    {
        matchable_string: "hypothyroidism low T4",
        name: "Hypothyroidism",
        id: "diagnosis-hypothyroidism",
        html: ``
    },
    {
        matchable_string: "ischaemic heart disease NSTEMI",
        name: "Ischaemic Heart Disease",
        id: "diagnosis-ihd",
        html: `
            <div class="hstack">
                <label>
                    Stable Disease
                    <div class="selectbox">
                        <select diagnosis-parameter="Stable disease" autocomplete="off">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Antiplatets
                    <div class="selectbox">
                        <select diagnosis-parameter="Antiplatelets" autocomplete="off">
                            <option value="" selected></option>
                            <option value="single">Single</option>
                            <option value="dual">Dual</option>
                            <option value="none">None</option>
                        </select>
                    </div>
                </label>
            </div>
            <label>
                Last Stress Test
                <input type="text" diagnosis-parameter="Last stress test" placeholder="Date and findings">
            </label>`
    },
    {
        matchable_string: "chronic pain CRPS",
        name: "Chronic Pain",
        id: "diagnosis-chronic-pain",
        html: `
            <div class="hstack">
                <label>
                    Opioid Tolerance
                    <div class="selectbox">
                        <select diagnosis-parameter="Opioid tolerance" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    CRPS Features
                    <div class="selectbox">
                        <select diagnosis-parameter="CRPS features" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <div class="hstack">
                <label>
                    Pain Specialist
                    <input type="text" diagnosis-parameter="Treating specialist">
                </label>
            </div>`
    },
    {
        matchable_string: "stroke TIA CVA",
        name: "Cerebrovascular Accident",
        id: "diagnosis-cva",
        html: `
            <div class="hstack">
                <label>
                    Details of Infarct(s)
                    <input type="text" diagnosis-parameter="Infarct details">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Motor Weakness
                    <div class="selectbox">
                        <select diagnosis-parameter="Residual motor weakness" autocomplete="off">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Pharyngeal Symptoms
                    <div class="selectbox">
                        <select diagnosis-parameter="Residual pharyngeal symptoms" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "epilepsy seizure",
        name: "Seizure Disorder",
        id: "diagnosis-seizures",
        html: `
            <label>
                Triggers
                <input type="text" diagnosis-parameter="Triggers">
            </label>
            <label>
                Seizure Frequency
                <input type="text" diagnosis-parameter="Frequency">
            </label>
            <div class="hstack">
                <label>
                    AED Compliant
                    <div class="selectbox">
                        <select diagnosis-parameter="Compliant with AEDs" autocomplete="off">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Previous Status Epilepticus
                    <div class="selectbox">
                        <select diagnosis-parameter="Previous status epilepticus" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "ckd chronic kidney disease",
        name: "Chronic Kidney Disease",
        id: "diagnosis-ckd",
        html: `
            <div class="hstack">
                <label>
                    KDIGO Stage
                    <div class="selectbox">
                        <select diagnosis-parameter="KDIGO stage" autocomplete="off">
                            <option value="" selected></option>
                            <option value="1">1 (GFR ≥ 90)</option>
                            <option value="2">2 (GFR 60–89)</option>
                            <option value="3a">3a (GFR 45–59)</option>
                            <option value="3b">3b (GFR 30–44)</option>
                            <option value="4">4 (GFR 15–29)</option>
                            <option value="5">5 (GFR ≤ 14 or on dialysis)</option>
                        </select>
                    </div>
                </label>
                <label>
                    Aetiology
                    <input type="text" diagnosis-parameter="Aetiology">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Dialysis Dependent
                    <div class="selectbox">
                        <select diagnosis-parameter="Dialysis-dependent" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                     
                    <input type="text" diagnosis-parameter="Dialysis details" placeholder="Details">
                </label>
            </div>
            <label>
                Renal Physician
                <input type="text" diagnosis-parameter="Renal physician">
            </label>`
    },
    {
        matchable_string: "iron deficiency anaemia",
        name: "Anaemia",
        id: "diagnosis-anaemia",
        html: `
            <label>
                Aetiology
                <input type="text" diagnosis-parameter="Aetiology">
            </label>
            <label>
                Treatment
                <input type="text" diagnosis-parameter="Treatment">
            </label>`
    },
    {
        matchable_string: "OA osteoarthritis",
        name: "Osteoarthritis",
        id: "diagnosis-osteoarthritis",
        html: `
            <label>
                Affected Joints
                <input type="text" diagnosis-parameter="Affected joints">
            </label>
            <div class="hstack">
                <label>
                    Opioid Dependent
                    <div class="selectbox">
                        <select diagnosis-parameter="Opioid dependent" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "human immunodeficiency virus",
        name: "HIV",
        id: "diagnosis-hiv",
        html: `
            <div class="hstack">
                <label>
                    CD4 Count
                    <input type="text" diagnosis-parameter="CD4 count">
                </label>
                <label>
                    Viral Load
                    <input type="text" diagnosis-parameter="Viral load">
                </label>
            </div>
            <label>
                Infectious Complications
                <input type="text" diagnosis-parameter="Viral load">
            </label>
            <label>
                Antiviral Regimen
                <input type="text" diagnosis-parameter="Antiviral regimen">
            </label>`
    },
    {
        matchable_string: "child pugh liver cirrhosis",
        name: "Liver Cirrhosis",
        id: "diagnosis-cirrhosis",
        html: `
            <label>
                Aetiology
                <input type="text" diagnosis-parameter="Aetiology">
            </label>
            <div class="hstack">
                <label>
                    Child-Pugh Class
                    <div class="selectbox">
                        <select diagnosis-parameter="Child-Pugh" autocomplete="off">
                            <option value="" selected></option>
                            <option value="A (100% one-year survival)">A (100% one-year survival)</option>
                            <option value="B (80% one-year survival)">B (80% one-year survival)</option>
                            <option value="C (45% one-year survival)">C (45% one-year survival)</option>
                        </select>
                    </div>
                </label>
                <label>
                    MELD Score
                    <input type="number" min="0" max="100" step="1" diagnosis-parameter="MELD">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Varices
                    <div class="selectbox">
                        <select diagnosis-parameter="Varices" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Coagulopathy
                    <div class="selectbox">
                        <select diagnosis-parameter="Coagulopathy" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>
            <label>
                Ascites Management
                <input type="text" diagnosis-parameter="Ascites management">
            </label>`
    },
    {
        matchable_string: "obstructive sleep apnoea",
        name: "Obstructive Sleep Apnoea",
        id: "diagnosis-osa",
        html: `
            <div class="hstack">
                <label>
                    AHI
                    <input type="number" min="0" max="300" step="1" diagnosis-parameter="AHI">
                </label>
                <label>
                    CPAP User
                    <div class="selectbox">
                        <select diagnosis-parameter="CPAP" autocomplete="off">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "alzheimer's dementia",
        name: "Dementia",
        id: "diagnosis-alzheimers",
        html: `
            <label>
                Aetiology
                <input type="text" diagnosis-parameter="Aetiology">
            </label>
            <div class="hstack">
                <label>
                    Baseline MoCA/MMSE
                    <input type="number" min="0" max="30" step="1" diagnosis-parameter="Baseline MoCA/MMSE">
                </label>
                <label>
                    Can Lay Still
                    <div class="selectbox">
                        <select diagnosis-parameter="Can lay still" autocomplete="off">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "steatohepatitis nonalcoholic fatty liver disease",
        name: "Steatohepatitis",
        id: "diagnosis-steatohepatitis",
        html: ``
    },
    {
        matchable_string: "peptic gastric ulcers disease",
        name: "Peptic Ulcer Disease",
        id: "diagnosis-pud",
        html: ``
    },
    {
        matchable_string: "cataracts",
        name: "Cataracts",
        id: "diagnosis-cataracts",
        html: ``
    },
    {
        matchable_string: "glaucoma",
        name: "Glaucoma",
        id: "diagnosis-glaucoma",
        html: ``
    },
    {
        matchable_string: "gastro-oesophageal reflux disease",
        name: "GORD",
        id: "diagnosis-gord",
        html: `
            <div class="hstack">
                <label>
                    Medicated
                    <div class="selectbox">
                        <select diagnosis-parameter="Medicated">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Ongoing Symptoms
                    <div class="selectbox">
                        <select diagnosis-parameter="Ongoing symptoms">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "anaphylaxis",
        name: "Anaphylaxis",
        id: "diagnosis-anaphylaxis",
        html: `
            <div class="hstack">
                <label>
                    Confirmed Diagnosis
                    <div class="selectbox">
                        <select diagnosis-parameter="Confirmed diagnosis">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
            </div>
            <label>
                Triggers
                <input type="text" diagnosis-parameter="Triggers">
            </label>`
    },
    {
        matchable_string: "permanent pacemaker",
        name: "Pacemaker",
        id: "diagnosis-pacemaker",
        html: `
            <div class="hstack">
                <label>
                    Indication
                    <input type="text" diagnosis-parameter="Indication">
                </label>
                <label>
                    Last Checked
                    <input type="text" diagnosis-parameter="Last checked">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Mode
                    <input type="text" diagnosis-parameter="Mode">
                </label>
                <label>
                    Manufacturer
                    <input type="text" diagnosis-parameter="Manufacturer">
                </label>
            </div>
            <label>
                Pacing Dependence
                <input type="text" diagnosis-parameter="Pacing dependence">
            </label>`
    },
    {
        matchable_string: "internal cardiac defibrillator",
        name: "ICD",
        id: "diagnosis-icd",
        html: `
            <div class="hstack">
                <label>
                    Indication
                    <input type="text" diagnosis-parameter="Indication">
                </label>
                <label>
                    Last Checked
                    <input type="text" diagnosis-parameter="Last checked">
                </label>
            </div>
            <div class="hstack">
                <label>
                    Diathermy in Use
                    <div class="selectbox">
                        <select diagnosis-parameter="Diathermy in use" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
                <label>
                    Manufacturer
                    <input type="text" diagnosis-parameter="Manufacturer">
                </label>
            </div>
            <label>
                Trigger Frequency
                <input type="text" diagnosis-parameter="Trigger frequency">
            </label>`
    },
    {
        matchable_string: "abdominal aortic aneurysm",
        name: "AAA",
        id: "diagnosis-aaa",
        html: `
            <div class="hstack">
                <label>
                    Size (cm)
                    <input type="number" min="0" max="30" step="0.1" diagnosis-parameter="Size">
                </label>
                <label>
                    Stable
                    <div class="selectbox">
                        <select diagnosis-parameter="Stable" autocomplete="off">
                            <option value="" selected></option>
                            <option value="yes">Yes</option>
                            <option value="NO">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
    {
        matchable_string: "osteoporosis",
        name: "Osteoporosis",
        id: "diagnosis-osteoporosis",
        html: ``
    },
    {
        matchable_string: "transcatheter aortic valve implant replacment",
        name: "TAVI",
        id: "diagnosis-tavi",
        html: `
            <div class="hstack">
                <label>
                    Year Implanted
                    <input type="text" diagnosis-parameter="Year implanted">
                </label>
                <label>
                    Known Leak
                    <div class="selectbox">
                        <select diagnosis-parameter="Known leak" autocomplete="off">
                            <option value="" selected></option>
                            <option value="YES">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </label>
            </div>`
    },
]

// UTILS
function escapeHTML(html) {
    // https://stackoverflow.com/questions/5499078/fastest-method-to-escape-html-tags-as-html-entities
    // https://stackoverflow.com/a/55081825
    return new Option(html).innerHTML
}

// Create custom element
customElements.define('clinic-diagnosis', class extends HTMLElement {
    constructor () {
        super()
    }

    connectedCallback() {
        this.setAttribute('clinic-parameter', this.data['id'])
        this.innerHTML = `
            <div class="clinic-diagnosis-top">
                <label>
                    <input type="text" class="diagnosis-title" diagnosis-parameter="name" value="${this.data['name'] || ''}">
                </label>
                <button class="clinic-diagnosis-edit" tabindex="3" onclick="this.previousElementSibling.focus()">Edit</button>
                <button class="clinic-diagnosis-close" tabindex="3">Close</button>
            </div>
            <div class="clinic-diagnosis-body vstack">
                ${this.data['html'] || ''}
                <label>
                    Details
                    <textarea type="text" class="bigbox short" diagnosis-parameter="other-details"></textarea>
                </label>
            </div>
            <div class="clinic-diagnosis-bottom">
                <button onclick="this.closest('clinic-diagnosis')?.delete()">Delete</button>
            </div>
        `
        for (let key in this.data) {
            // check for a target
            let targetElement = this.querySelector(`.clinic-diagnosis-body [diagnosis-parameter="${key}"]`)

            // abort if none is found
            if (!targetElement) continue

            // attempt to re-insert it
            setAnyInputValue(targetElement, this.data[key])
        }

        // save to localStorage, the cheeky way
        this.querySelector('[diagnosis-parameter]').dispatchEvent(new Event('input', {bubbles: true}))
    }

    renderText() {
        // return text
        let data = this.serialise()
        let output = ""

        // get name
        output += `- ${data['name']}`

        // delete surplus keys
        delete data['name']
        delete data['id']
        
        // add regular details
        for (let key in data) {
            if (key == 'other-details') continue
            
            // skip blank lines
            let value = data[key]
            if (`${value}`.length == 0) continue

            // append to output
            output = output + `\n    - ${key}: ${value}`
        }

        // add in other details
        if (data['other-details']) {
            let otherDetails = data['other-details']
                .split('\n')
                .map((l) => '    ' + l)
                .join('\n')
            output += `\n${otherDetails}`
        }

        return output
    }

    serialise() {
        let dataDump = {
            id: this.getAttribute('clinic-parameter'),
        }
        for (let input of this.querySelectorAll('[diagnosis-parameter]')) {
            let attr = input.getAttribute('diagnosis-parameter')
            dataDump[attr] = getAnyInputValue(input)
        }
        return dataDump
    }

    delete() {
        let answer = confirm(`Delete "${this.serialise()['name']}"?`)
        if (answer) {
            delete persistentDataProxy[this.getAttribute('clinic-parameter')]

            let nextDiagnosis = this?.nextElementSibling
            let prevDiagnosis = this?.previousElementSibling
            this.remove()
            
            // Plan A: focus next sibling
            if (nextDiagnosis?.matches('clinic-diagnosis')) {
                setFocusedDiagnosis(nextDiagnosis)
            }

            // Plan B: focus previous sibling
            if (prevDiagnosis?.matches('clinic-diagnosis')) {
                setFocusedDiagnosis(prevDiagnosis)
            }

            // Plan C: focus search box
            diagnosisSearchBox.focus()

            // delete from persistentDataProxy (which will trigger Beagle to re-evaulate too)
            delete persistentDataProxy[this.data.id]
        }
    }
})

function insertClinicDiagnosis(data, target, position, focus=true) {
    // Create element
    let newDiagnosisElement = document.createElement('clinic-diagnosis')

    // Add data
    newDiagnosisElement.data = data

    // Create new diagnosis markup with data from target <li>
    target.insertAdjacentElement(position, newDiagnosisElement)

    // Populate synced values
    // TODO: just do this from dataProxy, not DOM
    let syncedInputs = newDiagnosisElement.querySelectorAll('[clinic-sync]')
    for (let i of syncedInputs) {
        let parameterName = i.getAttribute('clinic-sync')

        let syncTargets = document.querySelectorAll(`[clinic-sync="${parameterName}"]`)
        if (!syncTargets) continue
        
        let syncValue
        for (let t of syncTargets) {
            if (t == newDiagnosisElement) continue
            syncValue = getAnyInputValue(t)
            if (syncValue) break
        }

        if (!syncValue) continue
        setAnyInputValue(i, syncValue)
    }

    if (focus) {
        // Open it and set focus on the first non-title input element (be it a textarea or an input)
        setFocusedDiagnosis(newDiagnosisElement)
        setTimeout(() => { newDiagnosisElement.querySelector('select, textarea, input:not(.diagnosis-title)').focus() }, 0)
    }


    return newDiagnosisElement
}

// Handle expansion/shrinking of each diagnosis

function setFocusedDiagnosis(target) {
    for (let t of diagnosisList.querySelectorAll('clinic-diagnosis')) {
        t.removeAttribute('aria-selected')
    }
    if (target) {
        target.setAttribute('aria-selected', true)
        if (!target.matches(':focus-within')) {
            setTimeout(() => { target.querySelector('select, textarea, input:not(.diagnosis-title)').focus() }, 0)
        }
    }
}

// diagnosisList.addEventListener('mousedown', (e) => {
//     let targetDiagnosis = e.target.closest('clinic-diagnosis')
//     setFocusedDiagnosis(targetDiagnosis)
// })
diagnosisList.addEventListener('focusin', (e) => {
    let targetDiagnosis = e.target.closest('clinic-diagnosis')
    setFocusedDiagnosis(targetDiagnosis)
})
diagnosisList.addEventListener('focusout', (e) => {
    setFocusedDiagnosis(null)
})

// ESCAPE to go back to search
diagnosisList.addEventListener('keydown', (e) => {
    if (e.key == "Escape") {
        diagnosisSearchBox.focus()
    }
})

// SEARCH RESULTS

function insertSearchResult(target, data) {
    // make id unique
    data['id'] = data['id']

    let newResult = document.createElement('li')
    newResult.innerHTML = `${data['name']}<button>Add to PMHx</button></li>`
    newResult.data = data
    newResult.onclick = (e) => {
        // insert new diagnosis
        // or focus existing version
        let existingDiagnosis = document.querySelector(`[clinic-parameter="${data['id']}"]`)
        if (existingDiagnosis) {
            setFocusedDiagnosis(existingDiagnosis)
        } else {
            insertClinicDiagnosis(data, diagnosisList, "afterbegin", true)
        }
        // clear search
        diagnosisSearchBox.value = ''
        diagnosisSearchBox.dispatchEvent(new Event('input'))
    }
    target.insertAdjacentElement("beforeend", newResult)
}

diagnosisSearchBox.addEventListener('input', (e) => {
    // Find matches with fuzzysort
    let searchString = e.target.value.trim()
    let results = fuzzysort.go(searchString, allDiagnoses, {
        threshold: 0,
        limit: 4,
        all: false,
        key: "matchable_string",
    })

    // Clear stale results list
    diagnosisSearchResultsList.innerHTML = ''
    
    // Post new results list
    for (let r of results) {
        // send a shallow copy of the object
        // prevents ['id] from being mutated by insertSearchResults()
        // as much as rust is a pain, at least passing references vs copies is obvious
        insertSearchResult(diagnosisSearchResultsList, { ... r.obj})
    }

    // Post unedited query string as the last option
    if (searchString.length > 0) {
        insertSearchResult(diagnosisSearchResultsList, { name: escapeHTML(searchString), id: `diagnosis-user-defined-${Math.floor(Math.random() * 1000000000)}` })
    }

    // Mark first result as "selected"
    diagnosisSearchResultsList?.firstElementChild?.setAttribute('aria-selected', 'true')
})

diagnosisSearchBox.addEventListener('keydown', (e) => {
    if (e.key == "Escape") {
        e.target.value = ''
        e.target.dispatchEvent(new Event('input'))
    }
})

//    ____        _          ____               _     _                            
//   |  _ \  __ _| |_ __ _  |  _ \ ___ _ __ ___(_)___| |_ ___ _ __   ___ ___       
//   | | | |/ _` | __/ _` | | |_) / _ \ '__/ __| / __| __/ _ \ '_ \ / __/ _ \      
//   | |_| | (_| | || (_| | |  __/  __/ |  \__ \ \__ \ ||  __/ | | | (_|  __/      
//   |____/ \__,_|\__\__,_| |_|   \___|_|  |___/_|___/\__\___|_| |_|\___\___|      

// get from localStorage at startup
let persistentDataStore
try {
    persistentDataStore = JSON.parse(localStorage.getItem('clinic-data') || '') // JSON parser chokes on empty string if clinic-data isn't stored
} catch {
    persistentDataStore = {}
}

// establish proxy
let persistentDataProxy = new Proxy(persistentDataStore, {
    get(object, key, receiver) {
        return object[key]
    },
    set(object, key, value) {
        // Update UI

        // Update data model
        object[key] = value

        // Emit event

        // Persist data
        localStorage.setItem('clinic-data', JSON.stringify(object))

        // Send to beagle for sniffing
        sendToBeagle(object)
    },
    deleteProperty(object, key) {
        delete object[key]
        localStorage.setItem('clinic-data', JSON.stringify(object))

        // Send to beagle for sniffing
        sendToBeagle(object)

        return true
    }
})

function sendToBeagle(inputData) {
    beagle.postMessage({
        inputData: inputData,
    })
}

// display persisted data on load
for (let p in persistentDataProxy) {
    let storedData = persistentDataProxy[p]
    
    if (p.startsWith('diagnosis-')) {
        // find HTML if there is any pre-made markup to add
        let genericDiagnosisData = allDiagnoses.find((d) => d['id'] == storedData['id'] )
        storedData['html'] = genericDiagnosisData?.html || ''
        
        insertClinicDiagnosis(storedData, diagnosisList, "afterbegin", false)

        continue
    }

    let targetInputs = document.querySelectorAll(`[clinic-parameter="${p}"]`)
    for (let i of targetInputs) {
        setAnyInputValue(i, storedData)
    }
}

// give Beagle its intial sniff
beagle.postMessage({
    inputData: persistentDataStore,
})

// listen for input events on any element with clinic-parameter
document.body.addEventListener('input', (e) => {
    if (e.target.hasAttribute('clinic-parameter')) {
        persistentDataProxy[e.target.getAttribute('clinic-parameter')] = getAnyInputValue(e.target)
    }
    if (e.target.hasAttribute('diagnosis-parameter')) {
        let parentDiagnosis = e.target.closest('clinic-diagnosis')
        persistentDataProxy[parentDiagnosis.getAttribute('clinic-parameter')] = parentDiagnosis.serialise()
    }
})