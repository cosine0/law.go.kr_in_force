console.log('content script loaded');
const inForceColor = '#32A800';
const inForceHighlightColor = 'rgba(50,168,0,0.15)';
const inForceHueRotate = 270;
const inForceText = '현행';

const abolishedColor = '#FF0000';
const abolishedHighlightColor = 'rgba(255,0,0,0.15)';
const abolishedHueRotate = 150;
const abolishedText = '폐지';

const outdatedColor = '#c78900';
const outdatedHighlightColor = 'rgba(199,137,0,0.15)';
const outdatedHueRotate = 195;
const outdatedText = '과거 조문';

const futureColor = '#b5c200';
const futureHighlightColor = 'rgba(181,194,0,0.15)';
const futureHueRotate = 215;
const futureText = '시행 예정';

function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function mark(titleH2, labelText, labelColor, highlightColor, hueRotate) {
    console.log('marking', titleH2, labelText, labelColor, highlightColor, hueRotate);
    const titleContents = [];
    while (titleH2.firstChild) {
        titleContents.push(titleH2.removeChild(titleH2.firstChild));
    }
    titleH2.style.display = 'flex';
    titleH2.style.alignItems = 'center';
    titleH2.style.justifyContent = 'center';

    const titleDiv = document.createElement('div');
    titleDiv.style.font = 'inherit';
    titleDiv.style.padding = '0 0.3em';
    titleDiv.style.borderRadius = '0.4em';
    titleDiv.style.marginRight = '0.5em';

    // put in-force ("현행") label in as a span box on the right of the title
    const labelSpan = document.createElement('span');
    labelSpan.innerText = labelText;
    labelSpan.style.backgroundColor = labelColor;
    labelSpan.style.color = 'white';
    labelSpan.style.borderRadius = '0.45em';
    labelSpan.style.font = 'inherit';
    labelSpan.style.fontSize = '0.67em';
    labelSpan.style.padding = '0.05em 0.2em';
    labelSpan.style.verticalAlign = '0.17em';
    titleDiv.appendChild(labelSpan);

    // put original title contents
    const titleText = titleContents[0];
    titleText.textContent = ' ' + titleText.textContent.trim() + ' ';
    titleDiv.appendChild(titleText);
    for (let i = 1; i < titleContents.length; i++)
        titleDiv.appendChild(titleContents[i]);
    titleH2.appendChild(titleDiv);

    // also highlight the background of the title text
    titleDiv.style.backgroundColor = highlightColor;

    // finally change the color of upper bar image blue to green
    let upperBar = document.querySelector('.pophead');
    if (!upperBar)
        upperBar = document.querySelector('#pop_top');
    upperBar.style.filter = `hue-rotate(${hueRotate}deg)`;
}

function handleLaw(titleElement) {
    let lsId;
    let currentSequence;
    let currentEnforceDate;
    let historyUrl;
    if (location.pathname.includes('lumLsLinkPop')) {
        lsId = document.querySelector('#firstRlatLsId').value;
        currentSequence = document.querySelector('#lsLinkDivWrite + script')
            .text.match(/lsSearchObj.param.csq			= "(.*)";/)[1];
        let enforceDateElement = document.querySelector('#conTop > div > span');
        if (!enforceDateElement)
            enforceDateElement = document.querySelector('#linkedJoContent > div.subtit1');
        const enforceDateMatch = enforceDateElement.textContent.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
        currentEnforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
        historyUrl = `/LSW//lsHstListR.do?lsId=${lsId}`;
    } else if (location.pathname.search(/admRulLsInfoP|conAdmrulByLsPop/) !== -1) {
        lsId = document.querySelector('#admRulSeq').value;
        currentSequence = document.querySelector('#lsiSeq').value;
        const enforceDateElement = document.querySelector('#conTop > div');
        const enforceDateMatch = enforceDateElement.textContent.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
        currentEnforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
        historyUrl = `/LSW/admRulHstListR.do?admRulSeq=${lsId}`;
    } else if (location.pathname.search(/ordinLinkProc|ordinInfoP/) !== -1) {
        lsId = document.querySelector('#ordinId').value;
        currentSequence = document.querySelector('#ordinSeq').value;
        const enforceDateElement = document.querySelector('#conTop div.subtit1');
        const enforceDateMatch = enforceDateElement.textContent.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
        currentEnforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
        historyUrl = `/LSW/ordinHstListR.do?ordinId=${lsId}`;
    } else {
        lsId = document.querySelector('#lsId').value;
        currentSequence = document.querySelector('#lsiSeq').value;
        currentEnforceDate = document.querySelector('#efYd').value;
        historyUrl = `/LSW//lsHstListR.do?lsId=${lsId}`;
    }
    const todayDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    fetch(historyUrl)
        .then(response => response.text())
        .then(text => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const historyElements = doc.querySelectorAll('ul:first-child > li > a');
            const historyInfos = [];
            for (const item of historyElements) {
                let lawSequence;
                let enforceDate;
                let isInForce;
                let isAbolished;
                const onClickText = item.getAttribute('onclick');
                if (location.pathname.search(/admRulLsInfoP|conAdmrulByLsPop/) !== -1) {
                    const itemSubtitle = item.querySelector('.subtit1_1').textContent;
                    const enforceDateMatch = itemSubtitle.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
                    enforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
                    const match = onClickText.match(/javascript:admRulViewHst\(.*?,'(.*?)'\);return false;/);
                    lawSequence = match[1];
                    isAbolished = itemSubtitle.includes('폐지]');
                    isInForce = false;
                } else if (location.pathname.search(/ordinLinkProc|ordinInfoP/) !== -1) {
                    const itemSubtitle = item.lastChild.textContent;
                    const enforceDateMatch = itemSubtitle.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
                    enforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
                    const match = onClickText.match(/javascript:ordinViewOrdinHst\('(.*?)','(.*?)'\);return false;/);
                    lawSequence = match[1];
                    isInForce = match[2] === 'Y';
                    isAbolished = itemSubtitle.includes('폐지]');
                } else {
                    const match = onClickText.match(
                        /javascript:lsViewLsHst2\('(.*?)', '.*?', '.*?', '(.*?)', '(.*?)', '.*?' , '(.*?)'\);return false;/
                    );
                    if (!match)
                        continue;
                    lawSequence = match[1];
                    enforceDate = match[2];
                    isInForce = match[3] === 'Y';
                    isAbolished = match[4].includes('폐지');
                }

                if (lawSequence === currentSequence && enforceDate === currentEnforceDate) {
                    if (isInForce) {
                        mark(titleElement, inForceText, inForceColor, inForceHighlightColor, inForceHueRotate);
                        return;
                    }
                    if (item.querySelector('img[alt="앞으로 시행될 법령"]')) {
                        mark(titleElement, futureText, futureColor, futureHighlightColor, futureHueRotate);
                        return;
                    }
                    if (isAbolished) {
                        mark(titleElement, abolishedText, abolishedColor, abolishedHighlightColor, abolishedHueRotate);
                        return;
                    }
                }
                historyInfos.push({
                    lawSequence,
                    enforceDate,
                    isInForce,
                    isAbolished
                });
            }
            historyInfos.sort((a, b) => {
                let orderA = a.enforceDate + a.lawSequence;
                let orderB = b.enforceDate + b.lawSequence;
                if (orderA > orderB)
                    return -1;
                if (orderA < orderB)
                    return 1;
                return 0;
            });
            if (historyInfos[0].isAbolished) {
                mark(titleElement, abolishedText, abolishedColor, abolishedHighlightColor, abolishedHueRotate);
                return;
            }
            if (historyInfos[0].enforceDate === currentEnforceDate) {
                if (historyInfos[0].enforceDate > todayDate) {
                    mark(titleElement, futureText, futureColor, futureHighlightColor, futureHueRotate);
                    return;
                }
                if (historyInfos[0].lawSequence === currentSequence) {
                    mark(titleElement, inForceText, inForceColor, inForceHighlightColor, inForceHueRotate);
                    return;
                }
            }
            mark(titleElement, outdatedText, outdatedColor, outdatedHighlightColor, outdatedHueRotate);
        });
}

if (location.pathname.search(/^\/+(LSW\/+)?(ls(Side)?InfoP|lsLinkProc|admRulLsInfoP|conAdmrulByLsPop|ordinLinkProc|ordinInfoP)\.do$/) !== -1) {
    waitForElement('.ui-layout-pane.ui-layout-pane-center h2')
        .then(titleElement => handleLaw(titleElement));
} else if (location.pathname.search(/^\/+(LSW\/+)?lumLsLinkPop\.do$/) !== -1) {
    waitForElement('#firstRlatLsId')
        .then(() => handleLaw(document.querySelector('.ui-layout-pane.ui-layout-pane-center h2')));
}
