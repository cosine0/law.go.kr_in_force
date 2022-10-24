console.log('law.go.kr_in_force content script loaded');

function MarkStyle(color, highlightColor, hueRotate, labelHtml, tooltip) {
    this.color = color;
    this.highlightColor = highlightColor;
    this.hueRotate = hueRotate;
    this.labelHtml = labelHtml;
    this.tooltip = tooltip;
}

const markStyles = {
    upcoming: new MarkStyle(
        '#B5C200',
        'rgba(181,194,0,0.15)',
        215,
        '시행 예정',
        '아직 효력이 발생하기 전인 법령입니다.'
    ),
    inForce: new MarkStyle(
        '#32A800',
        'rgba(50,168,0,0.15)',
        270,
        '현행',
        '현재 적용되고 있는 법령입니다.'
    ),
    old: new MarkStyle(
        '#C78900',
        'rgba(199,137,0,0.15)',
        195,
        '구(舊)',
        '개정되어 효력을 잃은 과거 법령입니다.'
    ),
    abolished: new MarkStyle(
        '#FF0000',
        'rgba(255,0,0,0.15)',
        150,
        '폐지',
        '폐지되어 현재 존재하지 않는 법령입니다.'
    ),
};

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

function mark(titleH2, markStyle) {
    const titleContents = [];
    while (titleH2.firstChild) {
        titleContents.push(titleH2.removeChild(titleH2.firstChild));
    }
    titleH2.style.display = 'flex';
    titleH2.style.alignItems = 'center';
    titleH2.style.justifyContent = 'center';

    const titleDiv = document.createElement('div');
    titleDiv.classList.add('has-tooltip');
    titleDiv.style.backgroundColor = markStyle.highlightColor;
    titleDiv.style.font = 'inherit';
    titleDiv.style.padding = '0 0.3em';
    titleDiv.style.borderRadius = '0.4em';
    titleDiv.style.marginRight = '0.5em';
    const tooltipDiv = document.createElement('div');
    tooltipDiv.classList.add('tooltip');
    tooltipDiv.innerHTML = markStyle.tooltip;
    titleDiv.appendChild(tooltipDiv);

    const labelDiv = document.createElement('div');
    labelDiv.innerHTML = markStyle.labelHtml;
    labelDiv.style.display = 'inline-block';
    labelDiv.style.backgroundColor = markStyle.color;
    labelDiv.style.color = 'white';
    labelDiv.style.borderRadius = '0.45em';
    labelDiv.style.font = 'inherit';
    labelDiv.style.fontSize = '0.67em';
    labelDiv.style.padding = '0.05em 0.2em';
    labelDiv.style.verticalAlign = '0.17em';
    titleDiv.appendChild(labelDiv);

    // put original title contents
    const titleText = titleContents[0];
    titleText.textContent = ' ' + titleText.textContent.trim() + ' ';
    titleDiv.appendChild(titleText);
    for (let i = 1; i < titleContents.length; i++)
        titleDiv.appendChild(titleContents[i]);
    titleH2.appendChild(titleDiv);

    // finally change the color of upper bar image blue to green
    let upperBar = document.querySelector('.pophead');
    if (!upperBar)
        upperBar = document.querySelector('#pop_top');
    if (upperBar)
        upperBar.style.filter = `hue-rotate(${markStyle.hueRotate}deg)`;
    let coloredButtonBar = document.querySelector('.body_top_area');
    if (coloredButtonBar)
        coloredButtonBar.style.filter = `hue-rotate(${markStyle.hueRotate}deg)`;
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
    } else if (location.pathname.search(/admRulLsInfoP|conAdmrulByLsPop|admRulSc/) !== -1) {
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
            // when we got the history page, parse it and find status of the currently viewed law
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const historyElements = doc.querySelectorAll('ul:first-child > li > a');
            const historyInfos = [];
            for (const item of historyElements) {
                // parse the history list and find the currently viewed law
                let lawSequence;
                let enforceDate;
                let isInForce;
                let isAbolished;
                const onClickText = item.getAttribute('onclick');
                // determine the status of the law
                // note that if currently viewed law is an old version, and it is abolished,
                // "abolished" status precedences over "outdated" status
                if (location.pathname.search(/admRulLsInfoP|conAdmrulByLsPop|admRulSc/) !== -1) {
                    // for administrative rules
                    const itemSubtitle = item.querySelector('.subtit1_1').textContent;
                    const enforceDateMatch = itemSubtitle.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
                    enforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
                    const match = onClickText.match(/javascript:admRulViewHst\(.*?,'(.*?)'\);return false;/);
                    lawSequence = match[1];
                    isAbolished = itemSubtitle.includes('폐지]');
                    isInForce = false;
                } else if (location.pathname.search(/ordinLinkProc|ordinInfoP/) !== -1) {
                    // for ordinances
                    const itemSubtitle = item.lastChild.textContent;
                    const enforceDateMatch = itemSubtitle.match(/\[시행 (\d+)\. (\d+)\. (\d+)\.]/);
                    enforceDate = enforceDateMatch[1] + enforceDateMatch[2].padStart(2, '0') + enforceDateMatch[3].padStart(2, '0');
                    const match = onClickText.match(/javascript:ordinViewOrdinHst\('(.*?)','(.*?)'\);return false;/);
                    lawSequence = match[1];
                    isInForce = match[2] === 'Y';
                    isAbolished = itemSubtitle.includes('폐지]');
                } else {
                    // for laws
                    const match = onClickText.match(
                        /javascript:lsViewLsHst2\('(.*?)', '.*?', '.*?', '(.*?)', '(.*?)', '.*?' , '(.*?)'\);return false;/
                    );
                    if (!match) {
                        // false positive item, skip
                        continue;
                    }
                    lawSequence = match[1];
                    enforceDate = match[2];
                    isInForce = match[3] === 'Y';
                    isAbolished = match[4].includes('폐지');
                }
                if (lawSequence === currentSequence && enforceDate === currentEnforceDate) {
                    // if we found the currently viewed law, we are done searching so apply the style
                    // and finish
                    if (isInForce) {
                        mark(titleElement, markStyles.inForce);
                        return;
                    }
                    if (item.querySelector('img[alt="앞으로 시행될 법령"]')) {
                        mark(titleElement, markStyles.upcoming);
                        return;
                    }
                    if (isAbolished) {
                        mark(titleElement, markStyles.abolished);
                        return;
                    }
                }
                // if it's not the currently viewed law, save the information for later
                historyInfos.push({
                    lawSequence,
                    enforceDate,
                    isInForce,
                    isAbolished
                });
            }
            // if we didn't find the currently viewed law, we can't say it's in force,
            // so we check the last law in the history list and say as much as we can
            // about it
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
                mark(titleElement, markStyles.abolished);
                return;
            }
            if (historyInfos[0].enforceDate === currentEnforceDate) {
                // the last law has the same enforcement date as the currently viewed law,
                // so we assume current law has the same status as the last law
                if (historyInfos[0].enforceDate > todayDate) {
                    // the last law in the history list is in the future
                    mark(titleElement, markStyles.upcoming);
                    return;
                }
                if (historyInfos[0].lawSequence === currentSequence) {
                    // the last law in the history list is the currently viewed law
                    // this should never happen, but just in case
                    mark(titleElement, markStyles.inForce);
                    return;
                }
            }
            // the last law in the history list is not the currently viewed law
            // we resort to assuming it's so old that it's truncated from the history list
            mark(titleElement, markStyles.old);
        });
}

function main() {
    if (location.pathname.search(/^\/+(LSW\/+)?lumLsLinkPop\.do$/) !== -1) {
        waitForElement('#firstRlatLsId')
            .then(() => handleLaw(document.querySelector('.ui-layout-pane.ui-layout-pane-center h2')));
    } else {
        waitForElement('.ui-layout-pane.ui-layout-pane-center h2')
            .then(titleElement => handleLaw(titleElement));
    }
}

main();
