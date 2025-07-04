// ==UserScript==
// @name         Hide Words On All Websites
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Removes specific words on all websites
// @author       BadisG
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const wordsToRemove = ['asazfzefze', 'gdfgergerge'];

    const wordsLower = wordsToRemove.map(w => w.toLowerCase());
    // Create regex without word boundaries for patterns with special chars, with word boundaries for simple words
    const escapedPatterns = wordsToRemove.map(w => {
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Add word boundaries only for simple alphanumeric words
        if (/^[a-zA-Z0-9]+$/.test(w)) {
            return '\\b' + escaped + '\\b';
        }
        return escaped;
    });
    const regex = new RegExp('(' + escapedPatterns.join('|') + ')', 'gi');

    // Performance optimization: Cache processed elements
    const processedElements = new WeakSet();

    function normalizeText(text) {
        if (typeof text !== 'string') return '';

        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\u00A0/g, ' ')
            .replace(/ /g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function containsAnyWord(text) {
        const normalizedText = text.toLowerCase();
        return wordsLower.some(word => normalizedText.includes(word));
    }

    function getCleanTextContent(el) {
        if (!el) return '';
        let method1 = el.textContent || '';
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let method2 = '';
        let node;
        while (node = walker.nextNode()) { method2 += node.textContent; }
        let method3 = '';
        if (el.innerHTML) {
            method3 = el.innerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '');
        }
        method1 = method1.replace(/\s+/g, ' ').trim();
        method2 = method2.replace(/\s+/g, ' ').trim();
        method3 = method3.replace(/\s+/g, ' ').trim();
        const results = [method1, method2, method3].filter(r => r.length > 0);
        return results.sort((a, b) => b.length - a.length)[0] || '';
    }

    function processText(node) {
        if (!node.textContent) return;
        const original = node.textContent;

        if (regex.test(original)) {
            // ➊ keep a single space where the banned word was
            let newText = original.replace(regex, ' ');

            // ➋ collapse 2+ spaces
            newText = newText.replace(/\s{2,}/g, ' ');

            /* ★ ➌ smart-trim leading spaces ★ */
            const prev = node.previousSibling;
            const needLeadingSpace =
                  prev &&
                  !(prev.nodeType === 3 &&
                    /\s$/.test(prev.textContent));
            if (needLeadingSpace) {
                // make sure there is *one* leading space
                newText = newText.replace(/^\s*/, ' ');
            } else {
                // safe to drop all leading spaces
                newText = newText.replace(/^\s+/, '');
            }

            // Handle sentence capitalization
            newText = newText.replace(/([.!?]\s+)([a-z])/g,
                                      (_, p1, p2) => p1 + p2.toUpperCase());
            if (newText && /^[a-z]/.test(newText)) {
                newText = newText.charAt(0).toUpperCase() + newText.slice(1);
            }

            // Fix punctuation spacing - but preserve email addresses and other special cases
            newText = newText.replace(/\s+([,.!?;:])/g, '$1');

            // Add space after punctuation, but avoid breaking email addresses
            // Don't add space if punctuation is followed by @ or if it's part of an email pattern
            newText = newText.replace(/([,.!?;:])(?=\S)(?!@)/g, (match, punct, offset, string) => {
                // Check if this might be part of an email address
                const beforeContext = string.substring(Math.max(0, offset - 10), offset);
                const afterContext = string.substring(offset + 1, Math.min(string.length, offset + 11));

                // If it looks like an email pattern, don't add space
                if (/[a-zA-Z0-9]$/.test(beforeContext) && /^[a-zA-Z0-9@.]/.test(afterContext)) {
                    return punct;
                }

                return punct + ' ';
            });

            if (original !== newText) node.textContent = newText;
        }
    }

    function shouldHideElement(el) {
        if (!el || !el.tagName) return false;

        // Performance optimization: Skip if already processed
        if (processedElements.has(el)) return false;
        processedElements.add(el);

        // Quick text check first - much faster than complex processing
        const quickText = el.textContent || '';
        if (!regex.test(quickText)) return false;

        const elTagNameLower = el.tagName.toLowerCase();

        // Fast path for table cells and simple elements
        if (elTagNameLower === 'td' || elTagNameLower === 'th' || elTagNameLower === 'span') {
            const textContent = el.textContent || '';
            const normalizedText = textContent.toLowerCase().trim();

            // Direct match check
            if (wordsLower.includes(normalizedText)) {
                return true;
            }

            // Check if removing target words leaves empty or just whitespace/parentheses
            const textAfterRemoval = textContent.replace(regex, '').replace(/\s+/g, ' ').trim();
            const finalText = textAfterRemoval.replace(/^\(\s*\)$/, '').trim();
            if (finalText === '' && regex.test(textContent)) {
                return true;
            }

            return false;
        }

        // More complex processing for other elements (original logic)
        const rootNode = el.getRootNode();
        const host = rootNode?.host;
        const hostTagName = host ? host.tagName.toLowerCase() : 'N/A_Light_DOM';

        const cleanTextForGeneral = getCleanTextContent(el);
        const normalizedCleanForGeneral = normalizeText(cleanTextForGeneral);

        if (wordsLower.includes(normalizedCleanForGeneral)) {
            return true;
        }
        const rawTextOriginalForGeneral = el.textContent || '';
        const normalizedRawForGeneral = normalizeText(rawTextOriginalForGeneral);
        if (wordsLower.includes(normalizedRawForGeneral)) {
            return true;
        }
        const textAfterGeneralRemoval = normalizedCleanForGeneral.replace(regex, '').replace(/\s+/g, ' ').trim();
        const finalGeneralText = textAfterGeneralRemoval.replace(/^\(\s*\)$/, '').trim();
        if (finalGeneralText === '' && regex.test(normalizedCleanForGeneral)) {
            return true;
        }
        return false;
    }

    const processedShadowRoots = new WeakSet();

    function deepProcess(root, depth = 0) {
        if (!root) return;
        const context = depth === 0 ? 'MAIN_DOM' : `SHADOW_${depth}`;
        let hostInfo = 'N/A';
        if (root.host && root.host.tagName) {
            hostInfo = `<${root.host.tagName.toLowerCase()}>`;
        } else if (root.host) {
            hostInfo = 'ShadowRoot host (no tagName)';
        } else if (depth === 0 && (root === document.body || root === document.documentElement) ) {
            hostInfo = 'Document Body/Element';
        } else if (root.nodeName) {
            hostInfo = `Node <${root.nodeName.toLowerCase()}> (not a shadow host)`;
        }

        const elements = [];
        if (root.nodeType === Node.ELEMENT_NODE) {
            elements.push(root);
        }
        if (root.querySelectorAll) {
            try {
                elements.push(...Array.from(root.querySelectorAll('*')));
            } catch (e) {
                // Error handling without logging
            }
        }

        elements.forEach(el => {
            if (!el || !el.tagName) return;
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT' || el.tagName === 'META' || el.tagName === 'LINK' || el.tagName === 'TITLE') return;
            const elHostInfo = el.getRootNode()?.host?.tagName?.toLowerCase() || 'N/A_Light_DOM';

            if (shouldHideElement(el)) {
                el.style.display = 'none !important';
                el.style.visibility = 'hidden !important';
                el.style.opacity = '0 !important';
                el.style.height = '0px !important';
                el.style.width = '0px !important';
                el.style.margin = '0px !important';
                el.style.padding = '0px !important';
                el.style.border = 'none !important';
                el.style.overflow = 'hidden !important';
                if (!el.shadowRoot) {
                    return;
                }
            }
            if (el.shadowRoot && !processedShadowRoots.has(el.shadowRoot) ) {
                deepProcess(el.shadowRoot, depth + 1);
                processedShadowRoots.add(el.shadowRoot);
            }
        });

        const walker = document.createTreeWalker(
            root, NodeFilter.SHOW_TEXT,
            { acceptNode: (node) => (node.parentElement && (node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE' || node.parentElement.tagName === 'NOSCRIPT' || node.parentElement.style.display === 'none')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT },
            false
        );
        const textNodes = [];
        let currentTextNode;
        while (currentTextNode = walker.nextNode()) {
            if (regex.test(currentTextNode.textContent)) textNodes.push(currentTextNode);
        }
        if (textNodes.length > 0) {
            textNodes.forEach(processText);
        }
    }

    function findAllShadowRoots(rootNode = document.documentElement, found = new Set()) {
        if (!rootNode) return Array.from(found);
        if (rootNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && rootNode.host && !found.has(rootNode)) {
            found.add(rootNode);
        }
        const elements = rootNode.querySelectorAll ? rootNode.querySelectorAll('*') : [];
        for (const el of elements) {
            if (el.shadowRoot && !found.has(el.shadowRoot)) {
                found.add(el.shadowRoot);
                findAllShadowRoots(el.shadowRoot, found);
            }
        }
        return Array.from(found);
    }

    function processEverything(eventName = "INITIAL") {
        const mainProcessingRoot = document.body || document.documentElement;
        if (mainProcessingRoot) {
            deepProcess(mainProcessingRoot, 0);
        } else {
            return;
        }
        const allShadowRoots = findAllShadowRoots(document.documentElement);
        allShadowRoots.forEach((shadowRoot, index) => {
            if (shadowRoot && !processedShadowRoots.has(shadowRoot)) {
                const hostTag = shadowRoot.host ? shadowRoot.host.tagName.toLowerCase() : 'unknown host';
                deepProcess(shadowRoot, 1);
            }
        });
    }

    const observer = new MutationObserver(mutations => {
        let rootsToReprocess = new Set();

        for (const mutation of mutations) {
            // Determine the primary node related to the mutation
            let primaryNode = mutation.target;

            if (mutation.type === 'characterData') {
                // For text changes, we want to re-evaluate the parent element
                if (primaryNode.parentElement) {
                    rootsToReprocess.add(primaryNode.parentElement);
                }
            } else if (mutation.type === 'childList') {
                // For child list changes, the target is the parent. Add it for reprocessing.
                if (primaryNode.nodeType === Node.ELEMENT_NODE) {
                    rootsToReprocess.add(primaryNode);
                }
                // Also, specifically process any added nodes.
                mutation.addedNodes.forEach(addedNode => {
                    if (addedNode.nodeType === Node.ELEMENT_NODE) {
                        // Performance optimization: Only process if likely to contain target text
                        const quickText = addedNode.textContent || '';
                        if (regex.test(quickText)) {
                            rootsToReprocess.add(addedNode); // Process the new element itself

                            // Special handling for components that might initialize their shadow DOM late
                            if (addedNode.tagName === 'RHDC-USER-PROFILE-CARD' && addedNode.shadowRoot) {
                                rootsToReprocess.add(addedNode.shadowRoot);
                                const slCardElement = addedNode.shadowRoot.querySelector('sl-card');
                                if (slCardElement && slCardElement.shadowRoot) {
                                    rootsToReprocess.add(slCardElement.shadowRoot);
                                }
                            }
                        }
                    } else if (addedNode.nodeType === Node.TEXT_NODE && addedNode.parentElement) {
                        // If a text node is added, check if it contains target words
                        if (regex.test(addedNode.textContent || '')) {
                            rootsToReprocess.add(addedNode.parentElement);
                        }
                    }
                });
            }
        }

        if (rootsToReprocess.size > 0) {
            rootsToReprocess.forEach(item => {
                if (!item) return;
                // Check if item is still connected to the DOM before processing
                if (item.nodeType === Node.ELEMENT_NODE && !item.isConnected) {
                    return;
                }
                if (item.nodeType === Node.DOCUMENT_FRAGMENT_NODE && item.host && !item.host.isConnected) {
                    return;
                }

                if (item.nodeType === Node.DOCUMENT_FRAGMENT_NODE && item.host) { // Shadow Root
                    processedShadowRoots.delete(item); // Allow reprocessing
                    deepProcess(item, 1); // Depth 1 for shadow roots from observer
                } else if (item.nodeType === Node.ELEMENT_NODE) {
                    deepProcess(item); // Process the element and its descendants
                } else if (item === document) { // Should be rare now
                     deepProcess(document.body || document.documentElement);
                }
            });
        }
    });

    let observerStarted = false;
    function startObserving() {
        const target = document.documentElement || document.body;
        if (target) {
            if (observerStarted) return;
            observer.observe(target, { childList: true, subtree: true, characterData: true });
            observerStarted = true;
        }
    }

    let initCalled = false;
    function init() {
        if (initCalled) return;
        initCalled = true;
        const performInitialScan = (eventName) => {
            processEverything(eventName);
            startObserving();
        };
        if (document.readyState === 'loading') {
             document.addEventListener('DOMContentLoaded', () => {
                performInitialScan("DOMContentLoaded_DeferredInit");
            }, { once: true });
        } else {
            performInitialScan("INIT_readyState_" + document.readyState);
        }
        startObserving();
    }

    if (document.documentElement) {
        init();
    } else {
        const earlyLoadCheck = () => {
            if (document.documentElement) init();
            else window.addEventListener('DOMContentLoaded', init, { once: true });
        };
        earlyLoadCheck();
    }

    let delayedScanTimeoutId = null;
    let profileCardCheckIntervalId = null;
    let profileCardFoundAndScannedByDelayedOrInterval = false;

    window.addEventListener('load', () => {
        processEverything("WindowLoad");
        startObserving();
        if (delayedScanTimeoutId) clearTimeout(delayedScanTimeoutId);
        delayedScanTimeoutId = setTimeout(() => {
            if (!profileCardFoundAndScannedByDelayedOrInterval) {
                runDelayedSpecificScanForAllRoots();
            }
        }, 7000); // Fallback delay
    });

    function findAndProcessProfileCardsInRoot(scanRoot, scanRootName) {
        let foundInThisRootScan = false;
        try {
            const profileCards = scanRoot.querySelectorAll('rhdc-user-profile-card');
            if (profileCards.length > 0) {
                foundInThisRootScan = true; // Found at least one profile card in this specific root
            }

            profileCards.forEach((pCard, pIndex) => {
                if (pCard.shadowRoot) {
                    processedShadowRoots.delete(pCard.shadowRoot);
                    deepProcess(pCard.shadowRoot, 1);

                    const slCards = pCard.shadowRoot.querySelectorAll('sl-card');
                    slCards.forEach((slCard, slIndex) => {
                        if (slCard.shadowRoot) {
                            processedShadowRoots.delete(slCard.shadowRoot);
                            deepProcess(slCard.shadowRoot, 1);
                        }
                    });
                }
            });
        } catch (e) {
            // Error handling without logging
        }
        return foundInThisRootScan;
    }

    function runDelayedSpecificScanForAllRoots() {
        if (profileCardFoundAndScannedByDelayedOrInterval) {
            return;
        }
        let foundOverall = false;

        if (document.querySelectorAll) {
           if(findAndProcessProfileCardsInRoot(document, "main document")) {
               foundOverall = true;
           }
        }

        const currentShadowRoots = findAllShadowRoots(document.documentElement);
        currentShadowRoots.forEach(sr => {
            if (sr && sr.host && sr.querySelectorAll) {
                if(findAndProcessProfileCardsInRoot(sr, `shadowRoot of <${sr.host.tagName.toLowerCase()}>`)) {
                    foundOverall = true;
                }
            }
        });

        if (foundOverall) {
            profileCardFoundAndScannedByDelayedOrInterval = true;
            if (profileCardCheckIntervalId) clearInterval(profileCardCheckIntervalId);
            profileCardCheckIntervalId = null;
            if (delayedScanTimeoutId) clearTimeout(delayedScanTimeoutId);
            delayedScanTimeoutId = null;
        }
    }

    profileCardCheckIntervalId = setInterval(() => {
        if (profileCardFoundAndScannedByDelayedOrInterval) {
            if (profileCardCheckIntervalId) clearInterval(profileCardCheckIntervalId);
            profileCardCheckIntervalId = null;
            return;
        }
        runDelayedSpecificScanForAllRoots();
    }, 5000);

    setTimeout(() => {
        if (profileCardCheckIntervalId) {
            clearInterval(profileCardCheckIntervalId);
            profileCardCheckIntervalId = null;
        }
    }, 30000);

    setInterval(() => {
        if (typeof document === 'undefined' || !document.documentElement) return;
        const allShadowRoots = findAllShadowRoots(document.documentElement);
        let newRootsFoundThisScan = 0;
        allShadowRoots.forEach(shadowRoot => {
            if (shadowRoot && !processedShadowRoots.has(shadowRoot)) {
                newRootsFoundThisScan++;
                const hostTag = shadowRoot.host ? shadowRoot.host.tagName.toLowerCase() : 'unknown host';
                deepProcess(shadowRoot, 1);
            }
        });
    }, 100);

})();
