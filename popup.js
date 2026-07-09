document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('csvFile');
    const fileNameDisplay = document.getElementById('fileName');
    const submitBtn = document.getElementById('submitBtn');
    const uploadForm = document.getElementById('uploadForm');
    const statusMessage = document.getElementById('statusMessage');

    const expectedHeaders = ['Date', 'Unit', 'Sector', 'From', 'To', 'Duration', 'Note'];
    let parsedData = [];

    // Highlight drop area on drag
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });

    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            
            if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
                showStatus('Please upload a valid CSV file.', 'error');
                resetState();
                return;
            }

            fileNameDisplay.textContent = file.name;
            submitBtn.disabled = false;
            
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: function(header, index) {
                    if (index === 0) {
                        return "Date";
                    }
                    return header.trim();
                },
                complete: function(results) {
                    if (results.errors.length > 0) {
                        showStatus('Error parsing the CSV file.', 'error');
                        submitBtn.disabled = true;
                        return;
                    }

                    const headers = results.meta.fields;
                    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
                    
                    if (missingHeaders.length > 0) {
                        showStatus(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
                        submitBtn.disabled = true;
                        return;
                    }

                    parsedData = results.data;
                    showStatus('File validated successfully. Ready to process.', 'success');
                }
            });
        }
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.classList.remove('hidden');
    }

    function resetState() {
        fileNameDisplay.textContent = 'No file selected';
        submitBtn.disabled = true;
        fileInput.value = '';
        parsedData = [];
    }

    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (parsedData.length === 0) {
            showStatus('No data to process.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending to DGCA...';
        
        // Find active tab and send message
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                showStatus("No active tab found.", "error");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload and Process';
                return;
            }
            
            const activeTab = tabs[0];
            
            if (!activeTab.url.includes("dgca.gov.in")) {
                showStatus("Please go to the DGCA portal before processing.", "error");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload and Process';
                return;
            }

            // Execute scripting explicitly just in case content script wasn't loaded
            chrome.scripting.executeScript({
                target: {tabId: activeTab.id},
                files: ['content.js']
            }, () => {
                const autoAdd = document.getElementById('autoAddCheckbox').checked;
                // Send the data
                chrome.tabs.sendMessage(activeTab.id, {
                    action: "FILL_LOGBOOK",
                    data: parsedData,
                    autoAdd: autoAdd
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        showStatus("Error communicating with page. Ensure you are on the Logbook page.", "error");
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Upload and Process';
                    } else if (response && response.success) {
                        showStatus("Data successfully populated!", "success");
                        submitBtn.textContent = 'Done!';
                    } else {
                        showStatus(response ? response.error : "Unknown error", "error");
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Upload and Process';
                    }
                });
            });
        });
    });
});
