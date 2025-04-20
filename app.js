// تنظیمات اصلی
const config = {
    initialBalances: {
        BTC: 25,
        ETH: 50,
        USDT: 10000000,
        BNB: 500,
        TRX: 10000,
        DOGE: 50000,
        USD: 0
    },
    rewardAmount: 100, // پاداش هر دقیقه (دلار)
    rewardInterval: 60, // ثانیه
    autoTransferThreshold: 1000, // حداقل موجودی برای واریز خودکار (دلار)
    apiKeys: {
        bitcoin: "9f5a8a8327774717860323471961e884",
        etherscan: "1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
        blockcypher: "YOUR_BLOCKCYPHER_API_KEY"
    },
    bitcoinNode: "http://127.0.0.1:8332/",
    bitcoinAuth: "Basic " + btoa("username:password"),
    network: "mainnet",
    exchangeRates: {
        BTC: 50000,
        ETH: 3000,
        BNB: 400,
        TRX: 0.1,
        DOGE: 0.1
    }
};

// وضعیت برنامه
const state = {
    walletConnected: false,
    walletAddress: "",
    networkId: null,
    balances: {...config.initialBalances},
    web3: null,
    countdown: config.rewardInterval,
    countdownInterval: null,
    transactions: []
};

// عناصر DOM
const elements = {
    connectWallet: document.getElementById('connectWallet'),
    walletInfo: document.getElementById('walletInfo'),
    walletAddress: document.getElementById('walletAddress'),
    networkInfo: document.getElementById('networkInfo'),
    balances: document.getElementById('balances'),
    countdown: document.getElementById('countdown'),
    nextReward: document.getElementById('nextReward'),
    claimReward: document.getElementById('claimReward'),
    currencySelect: document.getElementById('currencySelect'),
    recipientAddress: document.getElementById('recipientAddress'),
    amount: document.getElementById('amount'),
    networkFee: document.getElementById('networkFee'),
    sendTransaction: document.getElementById('sendTransaction'),
    transactionStatus: document.getElementById('transactionStatus')
};

// رویدادها
elements.connectWallet.addEventListener('click', connectTrustWallet);
elements.claimReward.addEventListener('click', claimReward);
elements.sendTransaction.addEventListener('click', sendTransaction);
elements.currencySelect.addEventListener('change', calculateNetworkFee);

// شروع برنامه
init();

async function init() {
    startCountdown();
    updateBalancesUI();
    detectTrustWallet();
    loadExchangeRates();
}

// تشخیص Trust Wallet
function detectTrustWallet() {
    if (window.ethereum?.isTrust) {
        console.log("Trust Wallet detected");
        state.web3 = new Web3(window.ethereum);
        checkConnectedWallet();
    } else {
        console.warn("Trust Wallet not detected");
        showError("Trust Wallet یافت نشد. لطفاً از مرورگر درون برنامه استفاده کنید.");
    }
}

// بررسی اتصال قبلی
async function checkConnectedWallet() {
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            state.walletAddress = accounts[0];
            state.walletConnected = true;
            updateWalletUI();
            fetchBalances();
            elements.claimReward.disabled = false;
        }
    }
}

// اتصال به Trust Wallet
async function connectTrustWallet() {
    if (!window.ethereum) {
        showError("لطفاً Trust Wallet را نصب کنید یا از مرورگر درون برنامه استفاده نمایید");
        return;
    }

    try {
        setLoading(elements.connectWallet, "در حال اتصال...");
        
        // درخواست اتصال
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        // تنظیم Web3
        state.web3 = new Web3(window.ethereum);
        state.walletAddress = accounts[0];
        state.walletConnected = true;
        
        // دریافت شبکه
        state.networkId = await state.web3.eth.net.getId();
        
        // نمایش اطلاعات
        updateWalletUI();
        
        // دریافت موجودی‌ها
        await fetchBalances();
        
        // شروع سیستم پاداش
        elements.claimReward.disabled = false;
        
        // گوش دادن به تغییرات حساب
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        
    } catch (error) {
        console.error("خطا در اتصال:", error);
        showError(`خطا در اتصال: ${error.message}`);
        resetButton(elements.connectWallet, '<i class="fas fa-link"></i> اتصال به Trust Wallet');
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        state.walletAddress = accounts[0];
        updateWalletUI();
        fetchBalances();
    }
}

function handleChainChanged(chainId) {
    window.location.reload();
}

function disconnectWallet() {
    state.walletConnected = false;
    state.walletAddress = "";
    elements.walletInfo.style.display = "none";
    resetButton(elements.connectWallet, '<i class="fas fa-link"></i> اتصال به Trust Wallet');
    elements.claimReward.disabled = true;
}

// سیستم پاداش دهی
function startCountdown() {
    clearInterval(state.countdownInterval);
    state.countdown = config.rewardInterval;
    updateCountdown();
    
    state.countdownInterval = setInterval(() => {
        state.countdown--;
        updateCountdown();
        
        if (state.countdown <= 0) {
            elements.claimReward.disabled = !state.walletConnected;
            state.countdown = config.rewardInterval;
        }
    }, 1000);
}

function updateCountdown() {
    elements.countdown.textContent = state.countdown;
}

// دریافت پاداش
async function claimReward() {
    if (!state.walletConnected) return;
    
    try {
        setLoading(elements.claimReward, "در حال پردازش...");
        elements.claimReward.disabled = true;
        
        // افزایش موجودی
        state.balances.USD += config.rewardAmount;
        updateBalancesUI();
        
        // واریز خودکار اگر به آستانه رسید
        if (state.balances.USD >= config.autoTransferThreshold) {
            await autoTransferToWallet();
        }
        
        showSuccess(`پاداش ${config.rewardAmount} دلاری با موفقیت دریافت شد!`);
        startCountdown();
        
    } catch (error) {
        console.error("خطا در دریافت پاداش:", error);
        showError("خطا در دریافت پاداش!");
    } finally {
        resetButton(elements.claimReward, '<i class="fas fa-hand-holding-usd"></i> دریافت پاداش');
        elements.claimReward.disabled = false;
    }
}

// واریز خودکار به کیف پول
async function autoTransferToWallet() {
    const amountToTransfer = state.balances.USD;
    const usdtAmount = amountToTransfer; // نرخ 1:1 برای USDT
    
    try {
        showLoading("در حال واریز خودکار به کیف پول...");
        
        // انجام تراکنش واقعی
        const txHash = await sendUSDTTransaction(state.walletAddress, usdtAmount);
        
        // به‌روزرسانی موجودی
        state.balances.USD -= amountToTransfer;
        updateBalancesUI();
        
        // ثبت تراکنش
        addTransaction({
            type: "واریز خودکار",
            amount: usdtAmount,
            currency: "USDT",
            status: "موفق",
            txHash: txHash
        });
        
        showSuccess(`واریز خودکار ${usdtAmount.toLocaleString()} USDT با موفقیت انجام شد. هش تراکنش: ${txHash}`);
        
    } catch (error) {
        console.error("خطا در واریز خودکار:", error);
        showError("خطا در واریز خودکار: " + error.message);
    }
}

// نمایش موجودی‌ها
function updateBalancesUI() {
    elements.balances.innerHTML = `
        <div class="balance-card">
            <div class="currency-icon"><i class="fab fa-btc"></i></div>
            <h3>بیت‌کوین (BTC)</h3>
            <div class="balance-amount">${state.balances.BTC.toFixed(8)}</div>
            <div class="balance-value">≈ $${(state.balances.BTC * config.exchangeRates.BTC).toLocaleString()}</div>
        </div>
        
        <div class="balance-card">
            <div class="currency-icon"><i class="fab fa-ethereum"></i></div>
            <h3>اتریوم (ETH)</h3>
            <div class="balance-amount">${state.balances.ETH.toFixed(6)}</div>
            <div class="balance-value">≈ $${(state.balances.ETH * config.exchangeRates.ETH).toLocaleString()}</div>
        </div>
        
        <div class="balance-card">
            <div class="currency-icon"><i class="fas fa-dollar-sign"></i></div>
            <h3>تتر (USDT)</h3>
            <div class="balance-amount">${state.balances.USDT.toLocaleString()}</div>
            <div class="balance-value">≈ $${state.balances.USDT.toLocaleString()}</div>
        </div>
        
        <div class="balance-card">
            <div class="currency-icon"><i class="fab fa-btc"></i></div>
            <h3>بی‌ان‌بی (BNB)</h3>
            <div class="balance-amount">${state.balances.BNB.toFixed(4)}</div>
            <div class="balance-value">≈ $${(state.balances.BNB * config.exchangeRates.BNB).toLocaleString()}</div>
        </div>
        
        <div class="balance-card">
            <div class="currency-icon"><i class="fas fa-coins"></i></div>
            <h3>دلار (USD)</h3>
            <div class="balance-amount">${state.balances.USD.toLocaleString()}</div>
        </div>
    `;
}

// ارسال تراکنش
async function sendTransaction() {
    const currency = elements.currencySelect.value;
    const recipient = elements.recipientAddress.value.trim();
    const amount = parseFloat(elements.amount.value);
    
    // اعتبارسنجی
    if (!recipient || isNaN(amount) || amount <= 0) {
        showError("لطفاً اطلاعات معتبر وارد کنید");
        return;
    }
    
    if (amount > state.balances[currency]) {
        showError(`موجودی ناکافی! موجودی فعلی: ${state.balances[currency]} ${currency}`);
        return;
    }
    
    try {
        setLoading(elements.sendTransaction, "در حال ارسال...");
        elements.sendTransaction.disabled = true;
        
        let txHash;
        
        switch (currency) {
            case 'BTC':
                txHash = await sendBitcoinTransaction(recipient, amount);
                break;
                
            case 'ETH':
                txHash = await sendEthereumTransaction(recipient, amount);
                break;
                
            case 'USDT':
                txHash = await sendUSDTTransaction(recipient, amount);
                break;
                
            case 'BNB':
                txHash = await sendBNBTransaction(recipient, amount);
                break;
                
            case 'TRX':
                txHash = await sendTRXTransaction(recipient, amount);
                break;
                
            default:
                throw new Error("ارز انتخاب شده پشتیبانی نمی‌شود");
        }
        
        // به‌روزرسانی موجودی
        state.balances[currency] -= amount;
        updateBalancesUI();
        
        // ثبت تراکنش
        addTransaction({
            type: "ارسال",
            amount: amount,
            currency: currency,
            status: "موفق",
            txHash: txHash,
            recipient: recipient
        });
        
        showSuccess(`تراکنش با موفقیت انجام شد! هش: ${txHash}`);
        
    } catch (error) {
        console.error("خطا در ارسال تراکنش:", error);
        
        // ثبت تراکنش ناموفق
        addTransaction({
            type: "ارسال",
            amount: amount,
            currency: currency,
            status: "ناموفق",
            error: error.message,
            recipient: recipient
        });
        
        showError("خطا در ارسال تراکنش: " + error.message);
    } finally {
        resetButton(elements.sendTransaction, '<i class="fas fa-paper-plane"></i> ارسال تراکنش');
        elements.sendTransaction.disabled = false;
    }
}

// محاسبه کارمزد شبکه
async function calculateNetworkFee() {
    const currency = elements.currencySelect.value;
    
    try {
        elements.networkFee.innerHTML = '<div class="loading"></div> در حال محاسبه...';
        
        let fee;
        switch (currency) {
            case 'BTC':
                fee = await calculateBitcoinFee();
                break;
                
            case 'ETH':
            case 'USDT':
                fee = await calculateEthereumFee();
                break;
                
            case 'BNB':
                fee = await calculateBNBFee();
                break;
                
            case 'TRX':
                fee = await calculateTRXFee();
                break;
                
            default:
                fee = "نامشخص";
        }
        
        elements.networkFee.textContent = fee;
    } catch (error) {
        console.error("خطا در محاسبه کارمزد:", error);
        elements.networkFee.textContent = "خطا در محاسبه";
    }
}

// ==================== توابع تراکنش‌های واقعی ====================

// ارسال بیت‌کوین
async function sendBitcoinTransaction(toAddress, amount) {
    try {
        // ایجاد تراکنش خام
        const rawTx = await axios.post(`${config.bitcoinNode}`, {
            jsonrpc: "1.0",
            id: "system",
            method: "createrawtransaction",
            params: [
                [],
                [{ [toAddress]: amount }]
            ]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.bitcoinAuth
            }
        });

        // امضای تراکنش
        const signedTx = await axios.post(`${config.bitcoinNode}`, {
            jsonrpc: "1.0",
            id: "system",
            method: "signrawtransactionwithwallet",
            params: [rawTx.data.result]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.bitcoinAuth
            }
        });

        // ارسال تراکنش
        const txHash = await axios.post(`${config.bitcoinNode}`, {
            jsonrpc: "1.0",
            id: "system",
            method: "sendrawtransaction",
            params: [signedTx.data.result.hex]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.bitcoinAuth
            }
        });

        return txHash.data.result;

    } catch (error) {
        console.error("Bitcoin Transaction Error:", error.response?.data || error.message);
        throw new Error("تراکنش بیت‌کوین ناموفق بود");
    }
}

// ارسال اتریوم
async function sendEthereumTransaction(toAddress, amount) {
    try {
        const amountWei = state.web3.utils.toWei(amount.toString(), 'ether');
        const tx = {
            from: state.walletAddress,
            to: toAddress,
            value: amountWei,
            gas: 21000
        };
        
        const gasPrice = await state.web3.eth.getGasPrice();
        tx.gasPrice = gasPrice;
        
        const receipt = await state.web3.eth.sendTransaction(tx);
        return receipt.transactionHash;
    } catch (error) {
        console.error("Ethereum Transaction Error:", error);
        throw new Error("تراکنش اتریوم ناموفق بود");
    }
}

// ارسال USDT
async function sendUSDTTransaction(toAddress, amount) {
    try {
        // قرارداد USDT (ERC-20)
        const contract = new state.web3.eth.Contract([
            {
                "constant": false,
                "inputs": [
                    {"name": "_to", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "transfer",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            }
        ], "0xdac17f958d2ee523a2206206994597c13d831ec7"); // آدرس قرارداد USDT
        
        const amountUnits = amount * Math.pow(10, 6); // USDT 6 رقم اعشار
        
        const tx = contract.methods.transfer(
            toAddress,
            amountUnits.toString()
        );
        
        const gas = await tx.estimateGas({ from: state.walletAddress });
        const gasPrice = await state.web3.eth.getGasPrice();
        
        const receipt = await tx.send({
            from: state.walletAddress,
            gas,
            gasPrice
        });
        
        return receipt.transactionHash;
    } catch (error) {
        console.error("USDT Transaction Error:", error);
        throw new Error("تراکنش USDT ناموفق بود");
    }
}

// ارسال BNB
async function sendBNBTransaction(toAddress, amount) {
    try {
        const amountWei = state.web3.utils.toWei(amount.toString(), 'ether');
        const tx = {
            from: state.walletAddress,
            to: toAddress,
            value: amountWei
        };
        
        const receipt = await state.web3.eth.sendTransaction(tx);
        return receipt.transactionHash;
    } catch (error) {
        console.error("BNB Transaction Error:", error);
        throw new Error("تراکنش BNB ناموفق بود");
    }
}

// ارسال TRX (نمونه - نیاز به TronWeb دارد)
async function sendTRXTransaction(toAddress, amount) {
    try {
        // این یک نمونه است. برای پیاده‌سازی واقعی نیاز به TronWeb دارید
        return "TRX_TRANSACTION_HASH_SAMPLE";
    } catch (error) {
        console.error("TRX Transaction Error:", error);
        throw new Error("تراکنش TRX ناموفق بود");
    }
}

// محاسبه کارمزد بیت‌کوین
async function calculateBitcoinFee() {
    try {
        const response = await axios.get(`https://api.blockcypher.com/v1/btc/main`, {
            params: {
                token: config.apiKeys.blockcypher
            }
        });
        
        const feeRate = response.data.medium_fee_per_kb / 1000; // تبدیل به ساتوشی/بایت
        const estimatedFee = Math.ceil(feeRate * 226); // 226 بایت برای تراکنش معمولی
        
        return `~${estimatedFee} ساتوشی ($${(estimatedFee * 0.00000001 * config.exchangeRates.BTC).toFixed(2)})`;
    } catch (error) {
        console.error("Bitcoin Fee Error:", error);
        return "~200 ساتوشی (تقریبی)";
    }
}

// محاسبه کارمزد اتریوم
async function calculateEthereumFee() {
    try {
        const gasPrice = await state.web3.eth.getGasPrice();
        const gasLimit = 21000; // برای انتقال ساده ETH
        const feeEth = state.web3.utils.fromWei((gasPrice * gasLimit).toString(), 'ether');
        
        return `~${feeEth} ETH ($${(feeEth * config.exchangeRates.ETH).toFixed(2)})`;
    } catch (error) {
        console.error("Ethereum Fee Error:", error);
        return "~0.001 ETH (تقریبی)";
    }
}

// محاسبه کارمزد BNB
async function calculateBNBFee() {
    try {
        const gasPrice = await state.web3.eth.getGasPrice();
        const gasLimit = 21000;
        const feeBnb = state.web3.utils.fromWei((gasPrice * gasLimit).toString(), 'ether');
        
        return `~${feeBnb} BNB ($${(feeBnb * config.exchangeRates.BNB).toFixed(2)})`;
    } catch (error) {
        console.error("BNB Fee Error:", error);
        return "~0.0005 BNB (تقریبی)";
    }
}

// محاسبه کارمزد TRX
async function calculateTRXFee() {
    // کارمزد ثابت TRX
    return "~0.1 TRX (ثابت)";
}

// دریافت نرخ ارزها
async function loadExchangeRates() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,tron,dogecoin,tether&vs_currencies=usd');
        config.exchangeRates = {
            BTC: response.data.bitcoin.usd,
            ETH: response.data.ethereum.usd,
            BNB: response.data.binancecoin.usd,
            TRX: response.data.tron.usd,
            DOGE: response.data.dogecoin.usd,
            USDT: 1
        };
        updateBalancesUI();
    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        // استفاده از نرخ‌های پیش‌فرض اگر API جواب نداد
    }
}

// ==================== توابع کمکی ====================

function updateWalletUI() {
    const shortAddress = `${state.walletAddress.substring(0, 6)}...${state.walletAddress.substring(38)}`;
    elements.walletAddress.textContent = shortAddress;
    elements.networkInfo.textContent = getNetworkName(state.networkId);
    elements.walletInfo.style.display = "block";
    resetButton(elements.connectWallet, '<i class="fas fa-check-circle"></i> اتصال موفق');
}

function getNetworkName(networkId) {
    const networks = {
        1: "Ethereum Mainnet",
        56: "Binance Smart Chain",
        137: "Polygon",
        // سایر شبکه‌ها
    };
    return networks[networkId] || `شبکه (ID: ${networkId})`;
}

function setLoading(element, text) {
    element.innerHTML = `<div class="loading"></div> ${text}`;
}

function resetButton(element, html) {
    element.innerHTML = html;
}

function showLoading(message) {
    elements.transactionStatus.style.display = "block";
    elements.transactionStatus.className = "transaction-status";
    elements.transactionStatus.innerHTML = `<div class="loading"></div> ${message}`;
}

function showSuccess(message) {
    elements.transactionStatus.style.display = "block";
    elements.transactionStatus.className = "transaction-status success";
    elements.transactionStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
}

function showError(message) {
    elements.transactionStatus.style.display = "block";
    elements.transactionStatus.className = "transaction-status error";
    elements.transactionStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${message}`;
}

function addTransaction(tx) {
    tx.timestamp = new Date();
    state.transactions.unshift(tx);
    // در اینجا می‌توانید تراکنش را به UI اضافه کنید
    console.log("تراکنش جدید:", tx);
}

async function fetchBalances() {
    if (!state.walletConnected) return;
    
    try {
        // دریافت موجودی ETH
        const ethBalance = await state.web3.eth.getBalance(state.walletAddress);
        state.balances.ETH = parseFloat(state.web3.utils.fromWei(ethBalance, 'ether'));
        
        // دریافت موجودی توکن‌ها (مثال برای USDT)
        // const usdtBalance = await getTokenBalance("0xdac17f958d2ee523a2206206994597c13d831ec7", 6);
        // state.balances.USDT = usdtBalance;
        
        updateBalancesUI();
    } catch (error) {
        console.error("Error fetching balances:", error);
    }
}

async function getTokenBalance(tokenAddress, decimals) {
    const contract = new state.web3.eth.Contract([
        {
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        }
    ], tokenAddress);
    
    const balance = await contract.methods.balanceOf(state.walletAddress).call();
    return balance / Math.pow(10, decimals);
}