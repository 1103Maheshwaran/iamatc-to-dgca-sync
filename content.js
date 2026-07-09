if (typeof window.dgcaAutoLoggerInitialized === 'undefined') {
    window.dgcaAutoLoggerInitialized = true;

    let globalParsedData = [];
    let currentRowIndex = 0;
    let globalAutoAdd = false;

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === "FILL_LOGBOOK") {

            // 1. Verify we are on the Logbook page by finding the h5 panel-title
            const titleElements = document.querySelectorAll('h5.panel-title');
            let isLogbookPage = false;

            for (let el of titleElements) {
                if (el.textContent.trim() === 'Logbook') {
                    isLogbookPage = true;
                    break;
                }
            }

            if (!isLogbookPage) {
                sendResponse({ success: false, error: "Logbook section not found on this page. Please navigate to 'Air Traffic Controllers e-Log Book' first." });
                return true;
            }

            // 2. Populate form fields if we have data
            if (request.data && request.data.length > 0) {
                globalParsedData = request.data;
                globalAutoAdd = request.autoAdd || false;
                currentRowIndex = globalParsedData.length - 1; // Start from the very bottom
                fillFormWithRow(currentRowIndex);
            }

            sendResponse({ success: true });
        }

        return true; // Keep message channel open for async response
    });

    // Use event delegation to catch clicks on dynamically loaded buttons
    document.addEventListener('click', function (e) {
        // Check if the user clicked the Add or Reset button (or an element inside them)
        if (e.target && (e.target.id === 'btnAddanssTrnTrainingDtlsVOList' || e.target.id === 'btnResetanssTrnTrainingDtlsVOList' || e.target.closest('#btnAddanssTrnTrainingDtlsVOList') || e.target.closest('#btnResetanssTrnTrainingDtlsVOList'))) {

            if (globalParsedData.length > 0) {
                currentRowIndex--; // Move backwards
                if (currentRowIndex >= 0) {
                    console.log(`IAMATC Logger: Proceeding to row ${currentRowIndex + 1} of ${globalParsedData.length}...`);
                    // Wait 3000ms for the DGCA page to process the click, save the data, clear the form, and be ready
                    setTimeout(() => {
                        fillFormWithRow(currentRowIndex);
                    }, 3000);
                } else {
                    console.log("IAMATC Logger: All rows processed.");
                    alert("Success! All rows from the CSV have been fully processed into the Logbook!");
                    globalParsedData = []; // Clear data
                }
            }
        }
    });

    function fillFormWithRow(index) {
        const entry = globalParsedData[index];
        const nextEntry = index + 1 < globalParsedData.length ? globalParsedData[index + 1] : null;

        console.log(`IAMATC Logger: Filling form with row ${index + 1}...`, entry);

        // Select the checkbox with name="isbriefingDone"
        const checkbox = document.querySelector('input[name="isbriefingDone"]');
        if (checkbox && !checkbox.checked) {
            checkbox.click();
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Helper to format date to dd/mm/yyyy and optionally add 1 day
        function processDateToDDMMYYYY(dateStr, addDay = false) {
            if (!dateStr) return '';
            let parts = dateStr.split(/[-/]/);
            if (parts.length === 3) {
                let d, m, y;
                if (parts[0].length === 4) {
                    y = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10) - 1;
                    d = parseInt(parts[2], 10);
                } else {
                    d = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10) - 1;
                    y = parseInt(parts[2], 10);
                    if (y < 100) y += 2000;
                }
                let dateObj = new Date(y, m, d);
                if (addDay) {
                    dateObj.setDate(dateObj.getDate() + 1);
                }
                let newD = String(dateObj.getDate()).padStart(2, '0');
                let newM = String(dateObj.getMonth() + 1).padStart(2, '0');
                let newY = dateObj.getFullYear();
                return `${newD}/${newM}/${newY}`;
            }
            return dateStr;
        }

        // Clean helper to set date fields
        function setDateClean(element, value) {
            if (!element) return;
            element.focus();
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.blur();
        }

        let formatTimeValue = entry['To'] || '';
        let addDay = false;

        if (formatTimeValue === "00:00") {
            if (nextEntry && nextEntry['From'] === "00:00") {
                formatTimeValue = nextEntry['To'] || '00:00';
                addDay = true;
            } else {
                formatTimeValue = "00:00";
                addDay = true;
            }
        }

        const logBookDateVal = processDateToDDMMYYYY(entry['Date'] || '', false);
        const logBookEndDateVal = processDateToDDMMYYYY(entry['Date'] || '', addDay);

        // Set Dates
        setDateClean(document.getElementById('logBookDate'), logBookDateVal);
        setDateClean(document.getElementById('logBookEndDate'), logBookEndDateVal);

        // Helper function to wait for dropdown options to populate
        function setDropdownWhenReady(selectElement, targetValue, nextCallback) {
            if (!selectElement) {
                nextCallback(false);
                return;
            }

            selectElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            selectElement.dispatchEvent(new Event('focus', { bubbles: true }));
            selectElement.click();

            if (!targetValue) {
                selectElement.value = "";
                selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                nextCallback(true);
                return;
            }

            const checkInterval = 20; // Check every 20ms
            const maxWaitTime = 2000; // Wait up to 2 seconds
            let elapsed = 0;

            const intervalId = setInterval(() => {
                elapsed += checkInterval;
                const hasOption = Array.from(selectElement.options).some(opt => opt.value === targetValue);

                if (hasOption || elapsed >= maxWaitTime) {
                    if (!hasOption) console.warn(`IAMATC Logger: Option ${targetValue} not found in ${selectElement.name}, setting anyway...`);
                    clearInterval(intervalId);
                    selectElement.value = targetValue;
                    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    nextCallback(true);
                }
            }, checkInterval);
        }

        // Helper function to set time fields and click Add
        function processTimes(entry, formatTimeValue) {
            const ojtStartTime = document.getElementById('ojtStartTime');
            if (ojtStartTime) {
                ojtStartTime.focus();
                ojtStartTime.value = entry['From'] || '';
                ojtStartTime.dispatchEvent(new Event('input', { bubbles: true }));
                ojtStartTime.dispatchEvent(new Event('change', { bubbles: true }));
                ojtStartTime.blur();
                ojtStartTime.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            const ojtEndTime = document.getElementById('ojtEndTime');
            if (ojtEndTime) {
                ojtEndTime.focus();
                ojtEndTime.value = formatTimeValue;
                ojtEndTime.dispatchEvent(new Event('input', { bubbles: true }));
                ojtEndTime.dispatchEvent(new Event('change', { bubbles: true }));
                ojtEndTime.blur();
                ojtEndTime.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            console.log(`IAMATC Logger: All fields filled completely for row ${index + 1}. Waiting for user to click Add or Reset.`);

            if (typeof globalAutoAdd !== 'undefined' && globalAutoAdd) {
                setTimeout(() => {
                    const addBtn = document.getElementById('btnAddanssTrnTrainingDtlsVOList');
                    if (addBtn) addBtn.click();
                }, 1000);
            }
        }

        // Set postingStation
        const postingStation = document.querySelector('select[name="postingStation"]');
        if (postingStation) {
            setDropdownWhenReady(postingStation, "100120", () => {
                const atStoEgcaId = document.querySelector('select[name="atStoEgcaId"]');
                if (atStoEgcaId) {
                    setDropdownWhenReady(atStoEgcaId, "OAAIM20210000010124", () => {
                        const ratingId = document.querySelector('select[name="ratingId"]');
                        if (ratingId) {
                            const unitValue = entry['Unit'] ? entry['Unit'].trim() : "";
                            let ratingVal = "";
                            if (unitValue === "ADC") ratingVal = "8000310";
                            else if (unitValue === "ADC+APP") ratingVal = "8000500";
                            else if (unitValue === "APP(S)") ratingVal = "8000312";

                            setDropdownWhenReady(ratingId, ratingVal, () => {
                                const atsUnitId = document.querySelector('select[name="atsUnitId"]');
                                if (atsUnitId) {
                                    let atsVal = "";
                                    if (unitValue === "ADC") atsVal = "ADC1";
                                    else if (unitValue === "ADC+APP") atsVal = "ADCAPP1";

                                    setDropdownWhenReady(atsUnitId, atsVal, () => {
                                        const typeOfDutyId = document.querySelector('select[name="typeOfDutyId"]');
                                        if (typeOfDutyId) {
                                            setDropdownWhenReady(typeOfDutyId, "1", () => {
                                                processTimes(entry, formatTimeValue);
                                            });
                                        } else {
                                            console.log("IAMATC Logger: Form filled up to atsUnitId. Data used:", entry);
                                        }
                                    });
                                } else {
                                    console.log("IAMATC Logger: Form filled up to ratingId. Data used:", entry);
                                }
                            });
                        } else {
                            console.log("IAMATC Logger: Form filled up to atStoEgcaId. Data used:", entry);
                        }
                    });
                } else {
                    console.log("IAMATC Logger: Form filled up to postingStation. Data used:", entry);
                }
            });
        } else {
            console.log("IAMATC Logger: Form filled (without station). Data used:", entry);
        }
    }

} // End of initialization check
