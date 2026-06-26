"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Cashier;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var staff_session_1 = require("@/lib/staff-session");
var api_1 = require("@/lib/api");
var auth_1 = require("@/lib/auth");
var utils_1 = require("@/lib/utils");
var button_1 = require("@/components/ui/button");
var card_1 = require("@/components/ui/card");
var dialog_1 = require("@/components/ui/dialog");
var lucide_react_1 = require("lucide-react");
function Cashier() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var staffName = (0, staff_session_1.getStaffName)();
    var _a = (0, react_1.useState)([]), bills = _a[0], setBills = _a[1];
    var totalOutstanding = bills.reduce(function (s, b) { return s + Number(b.total_amount || 0); }, 0);
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(null), selectedBill = _d[0], setSelectedBill = _d[1];
    var _e = (0, react_1.useState)(false), confirming = _e[0], setConfirming = _e[1];
    var _f = (0, react_1.useState)(null), receipt = _f[0], setReceipt = _f[1];
    var _g = (0, react_1.useState)(false), showReceipt = _g[0], setShowReceipt = _g[1];
    var _h = (0, react_1.useState)(false), showPaymentMethod = _h[0], setShowPaymentMethod = _h[1];
    var _j = (0, react_1.useState)(null), paymentMethod = _j[0], setPaymentMethod = _j[1];
    var _k = (0, react_1.useState)(false), processingPayment = _k[0], setProcessingPayment = _k[1];
    var _l = (0, react_1.useState)(false), showMpesaPrompt = _l[0], setShowMpesaPrompt = _l[1];
    var _m = (0, react_1.useState)(''), mpesaNumber = _m[0], setMpesaNumber = _m[1];
    var _o = (0, react_1.useState)(null), mpesaError = _o[0], setMpesaError = _o[1];
    var _p = (0, react_1.useState)(null), mpesaCheckoutId = _p[0], setMpesaCheckoutId = _p[1];
    var _q = (0, react_1.useState)(false), mpesaPolling = _q[0], setMpesaPolling = _q[1];
    var mpesaIntervalRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        if (!staffName) {
            navigate('/staff/login');
            return;
        }
        fetchPendingBills();
        var interval = setInterval(fetchPendingBills, 3000);
        var eventSource = new EventSource('/payments/stream/');
        eventSource.onmessage = function (event) {
            try {
                var payload = JSON.parse(event.data);
                if ((payload === null || payload === void 0 ? void 0 : payload.type) && ['order_update', 'new_order'].includes(payload.type)) {
                    fetchPendingBills();
                }
            }
            catch (err) {
                // ignore parse errors
            }
        };
        eventSource.onerror = function () {
            eventSource.close();
        };
        return function () {
            clearInterval(interval);
            eventSource.close();
        };
    }, [staffName, navigate]);
    var fetchPendingBills = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, errorMessage, errorData, _a, errorText, data, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 9, 10, 11]);
                    return [4 /*yield*/, fetch((0, api_1.getApiUrl)('/payments/cashier/pending-bills/'), {
                            method: 'GET',
                            headers: (0, auth_1.getAuthHeaders)(),
                        })];
                case 1:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 7];
                    errorMessage = "Failed to fetch pending bills (".concat(response.status, ")");
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, response.json()];
                case 3:
                    errorData = _b.sent();
                    if (errorData === null || errorData === void 0 ? void 0 : errorData.error)
                        errorMessage = errorData.error;
                    return [3 /*break*/, 6];
                case 4:
                    _a = _b.sent();
                    return [4 /*yield*/, response.text().catch(function () { return ''; })];
                case 5:
                    errorText = _b.sent();
                    if (errorText)
                        errorMessage = errorText;
                    return [3 /*break*/, 6];
                case 6: throw new Error(errorMessage);
                case 7: return [4 /*yield*/, response.json()];
                case 8:
                    data = _b.sent();
                    setBills(data.bills || []);
                    setError(null);
                    return [3 /*break*/, 11];
                case 9:
                    err_1 = _b.sent();
                    setError(err_1.message || 'Failed to fetch pending bills');
                    console.error('Fetch pending bills error:', err_1);
                    return [3 /*break*/, 11];
                case 10:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    var handleConfirmPayment = function (bill) {
        setSelectedBill(bill);
        setPaymentMethod(null);
        setShowPaymentMethod(true);
    };
    var handleProcessPayment = function (method) { return __awaiter(_this, void 0, void 0, function () {
        var normalized, headers, response, errorData, errorMsg, data, order_1, checkoutId_1, attempts_1, maxAttempts_1, err_2, err_3, errorMsg;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!selectedBill)
                        return [2 /*return*/];
                    setPaymentMethod(method);
                    setProcessingPayment(true);
                    setError(null);
                    setMpesaError(null);
                    setShowPaymentMethod(false);
                    // If MPESA, ensure a phone number is provided
                    if (method === 'mpesa') {
                        if (!mpesaNumber) {
                            setMpesaError('Enter MPESA phone number');
                            setProcessingPayment(false);
                            return [2 /*return*/];
                        }
                        normalized = (0, utils_1.normalizePhoneNumber)(mpesaNumber);
                        if (!(0, utils_1.isValidMpesaPhone)(mpesaNumber) || !normalized) {
                            setMpesaError('Enter a valid Kenyan M-Pesa number like +254712345678, 0712345678, or 712345678');
                            setProcessingPayment(false);
                            return [2 /*return*/];
                        }
                        setMpesaNumber(normalized);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, 11, 12]);
                    headers = __assign(__assign({}, (0, auth_1.getAuthHeaders)()), { 'Content-Type': 'application/json' });
                    return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/cashier/confirm-payment/".concat(selectedBill.order_id, "/")), {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({ payment_method: method, mpesa_number: method === 'mpesa' ? mpesaNumber : undefined }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.json().catch(function () { return ({}); })];
                case 3:
                    errorData = _a.sent();
                    errorMsg = errorData.error || errorData.detail || 'Failed to confirm payment';
                    if (method === 'mpesa') {
                        setMpesaError(errorMsg);
                        setProcessingPayment(false);
                        return [2 /*return*/];
                    }
                    throw new Error(errorMsg);
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = _a.sent();
                    order_1 = data.order;
                    // If MPESA flow started, backend returns checkout_request_id; poll status
                    if (method === 'mpesa') {
                        checkoutId_1 = data.checkout_request_id || (data.mpesa && data.mpesa.CheckoutRequestID) || null;
                        if (!checkoutId_1) {
                            setMpesaError('Failed to initiate M-Pesa payment. Please try again.');
                            setProcessingPayment(false);
                            return [2 /*return*/];
                        }
                        setMpesaCheckoutId(checkoutId_1);
                        setMpesaPolling(true);
                        setShowMpesaPrompt(false);
                        attempts_1 = 0;
                        maxAttempts_1 = 30;
                        mpesaIntervalRef.current = window.setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                            var st, stData, ordResp, ordJson, ord, err_4, err_5, err_6;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attempts_1 += 1;
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 15, , 16]);
                                        return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/status/?checkout_id=".concat(checkoutId_1)), { headers: (0, auth_1.getAuthHeaders)() })];
                                    case 2:
                                        st = _a.sent();
                                        if (!st.ok) return [3 /*break*/, 14];
                                        return [4 /*yield*/, st.json()];
                                    case 3:
                                        stData = _a.sent();
                                        if (!(stData.status === 'success')) return [3 /*break*/, 13];
                                        if (mpesaIntervalRef.current) {
                                            clearInterval(mpesaIntervalRef.current);
                                            mpesaIntervalRef.current = null;
                                        }
                                        setMpesaPolling(false);
                                        setMpesaCheckoutId(null);
                                        _a.label = 4;
                                    case 4:
                                        _a.trys.push([4, 11, , 12]);
                                        return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/orders/".concat(order_1.order_id, "/")), { headers: (0, auth_1.getAuthHeaders)() })];
                                    case 5:
                                        ordResp = _a.sent();
                                        if (!ordResp.ok) return [3 /*break*/, 10];
                                        return [4 /*yield*/, ordResp.json()];
                                    case 6:
                                        ordJson = _a.sent();
                                        ord = ordJson.order || ordJson;
                                        setReceipt({
                                            order_id: ord.order_id,
                                            waiter_name: ord.waiter_name,
                                            waiter_id: ord.waiter_id,
                                            order_type: ord.order_type,
                                            table: ord.table,
                                            table_id: ord.table_id,
                                            phone: ord.phone,
                                            items: ord.items,
                                            total_amount: ord.total_amount,
                                            timestamp: new Date().toLocaleString(),
                                        });
                                        setShowReceipt(true);
                                        if (!(ord.order_type === 'table' && ord.table_id)) return [3 /*break*/, 10];
                                        _a.label = 7;
                                    case 7:
                                        _a.trys.push([7, 9, , 10]);
                                        return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/pos/tables/".concat(ord.table_id, "/mark-free/")), { method: 'POST', headers: (0, auth_1.getAuthHeaders)() })];
                                    case 8:
                                        _a.sent();
                                        return [3 /*break*/, 10];
                                    case 9:
                                        err_4 = _a.sent();
                                        console.error('Error marking table as free:', err_4);
                                        return [3 /*break*/, 10];
                                    case 10: return [3 /*break*/, 12];
                                    case 11:
                                        err_5 = _a.sent();
                                        console.error('Failed to fetch order after MPESA success:', err_5);
                                        return [3 /*break*/, 12];
                                    case 12:
                                        // Optimistically remove cleared bill locally then refresh
                                        setBills(function (prev) { return prev.filter(function (b) { return b.order_id !== order_1.order_id; }); });
                                        setSelectedBill(null);
                                        fetchPendingBills();
                                        setProcessingPayment(false);
                                        return [2 /*return*/];
                                    case 13:
                                        if (stData.status === 'failed' || attempts_1 >= maxAttempts_1) {
                                            if (mpesaIntervalRef.current) {
                                                clearInterval(mpesaIntervalRef.current);
                                                mpesaIntervalRef.current = null;
                                            }
                                            setMpesaPolling(false);
                                            setMpesaCheckoutId(null);
                                            setError('M-Pesa payment failed or timed out. Bill remains outstanding.');
                                            setSelectedBill(null);
                                            setProcessingPayment(false);
                                            // Refresh bills to ensure consistency - bill remains in outstanding total
                                            setTimeout(function () { return fetchPendingBills(); }, 500);
                                            return [2 /*return*/];
                                        }
                                        _a.label = 14;
                                    case 14: return [3 /*break*/, 16];
                                    case 15:
                                        err_6 = _a.sent();
                                        console.error('MPESA status poll error:', err_6);
                                        return [3 /*break*/, 16];
                                    case 16:
                                        if (attempts_1 >= maxAttempts_1) {
                                            if (mpesaIntervalRef.current) {
                                                clearInterval(mpesaIntervalRef.current);
                                                mpesaIntervalRef.current = null;
                                            }
                                            setMpesaPolling(false);
                                            setMpesaCheckoutId(null);
                                            setError('M-Pesa payment timed out. Bill remains outstanding.');
                                            setSelectedBill(null);
                                            setProcessingPayment(false);
                                            // Refresh bills to ensure consistency - bill remains in outstanding total
                                            setTimeout(function () { return fetchPendingBills(); }, 500);
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 3000);
                        return [2 /*return*/];
                    }
                    if (!(order_1.order_type === 'table' && order_1.table_id)) return [3 /*break*/, 9];
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/pos/tables/".concat(order_1.table_id, "/mark-free/")), {
                            method: 'POST',
                            headers: (0, auth_1.getAuthHeaders)(),
                        })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    err_2 = _a.sent();
                    console.error('Error marking table as free:', err_2);
                    return [3 /*break*/, 9];
                case 9:
                    // Generate receipt for cash
                    setReceipt({
                        order_id: order_1.order_id,
                        waiter_name: order_1.waiter_name,
                        waiter_id: order_1.waiter_id,
                        order_type: order_1.order_type,
                        table: order_1.table,
                        phone: order_1.phone,
                        items: order_1.items,
                        total_amount: order_1.total_amount,
                        timestamp: new Date().toLocaleString(),
                    });
                    setShowReceipt(true);
                    // Optimistically remove cleared bill from local list and refresh
                    setBills(function (prev) { return prev.filter(function (b) { return b.order_id !== order_1.order_id; }); });
                    setSelectedBill(null);
                    setTimeout(function () { return fetchPendingBills(); }, 1000);
                    return [3 /*break*/, 12];
                case 10:
                    err_3 = _a.sent();
                    errorMsg = err_3.message || 'An error occurred while processing payment';
                    if (method === 'mpesa') {
                        setMpesaError(errorMsg);
                    }
                    else {
                        setError(errorMsg);
                    }
                    console.error('Payment confirmation error:', err_3);
                    return [3 /*break*/, 12];
                case 11:
                    if (!(method === 'mpesa' && mpesaPolling)) {
                        setProcessingPayment(false);
                    }
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    }); };
    var handlePrint = function () {
        var printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow && receipt) {
            printWindow.document.write("\n        <html>\n          <head>\n            <title>Order Receipt - ".concat(receipt.order_id, "</title>\n            <style>\n              body { font-family: monospace; padding: 20px; }\n              .receipt { width: 400px; margin: 0 auto; }\n              .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }\n              .order-info { margin: 10px 0; font-size: 12px; }\n              .items { margin: 20px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; }\n              .item { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }\n              .total { display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; font-size: 14px; }\n              .footer { text-align: center; margin-top: 20px; font-size: 10px; }\n            </style>\n          </head>\n          <body>\n            <div class=\"receipt\">\n              <div class=\"header\">\n                <h2>TASTY BITES HUB</h2>\n                <p>Receipt</p>\n              </div>\n              <div class=\"order-info\">\n                <p><strong>Order ID:</strong> ").concat(receipt.order_id, "</p>\n                <p><strong>Waiter:</strong> ").concat(receipt.waiter_name, "</p>\n                ").concat(receipt.waiter_id ? "<p><strong>Waiter ID:</strong> ".concat(receipt.waiter_id, "</p>") : '', "\n                <p><strong>Type:</strong> ").concat(receipt.order_type, "</p>\n                ").concat(receipt.phone ? "<p><strong>Phone:</strong> ".concat(receipt.phone, "</p>") : '', "\n                <p><strong>Time:</strong> ").concat(receipt.timestamp, "</p>\n              </div>\n              <div class=\"items\">\n                ").concat(receipt.items
                .map(function (item) {
                return "\n                  <div class=\"item\">\n                    <span>".concat((item.item_name || item.name), " x").concat(item.quantity, "</span>\n                    <span>KES ").concat((item.subtotal || ((item.unit_price || item.price) * item.quantity)).toFixed(2), "</span>\n                  </div>\n                ");
            })
                .join(''), "\n              </div>\n              <div class=\"total\">\n                <span>TOTAL:</span>\n                <span>KES ").concat(receipt.total_amount.toFixed(2), "</span>\n              </div>\n              <div class=\"footer\">\n                <p>Thank you for your order!</p>\n                <p>").concat(new Date().toLocaleString(), "</p>\n              </div>\n            </div>\n          </body>\n        </html>\n      "));
            printWindow.document.close();
            printWindow.print();
        }
    };
    if (!staffName) {
        return (<div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <card_1.Card className="w-full max-w-lg bg-slate-900 border-slate-700">
          <card_1.CardContent className="pt-6">
            <p className="text-center text-red-400">Staff session expired. Redirecting...</p>
          </card_1.CardContent>
        </card_1.Card>
      </div>);
    }
    return (<div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cashier Dashboard</p>
            <h1 className="text-4xl font-display font-bold text-white mt-2">Cashier Workstation</h1>
            <p className="mt-2 text-slate-400 max-w-2xl">
              Manage open tickets, confirm payments, and print receipts from a unified cashier interface.
            </p>
          </div>
          <button_1.Button onClick={function () { return navigate('/staff'); }} className="bg-orange-500 text-slate-950 hover:bg-orange-400 shadow-lg shadow-orange-500/20">
            Back to Dashboard
          </button_1.Button>
        </div>

        {error && (<div className="rounded-3xl border border-red-600/20 bg-red-600/10 p-5 text-sm text-red-100">
            <div className="flex items-start gap-3">
              <lucide_react_1.AlertCircle className="mt-0.5 text-red-300" size={20}/>
              <div>
                <p className="font-semibold text-red-100">Error</p>
                <p className="text-red-200">{error}</p>
              </div>
            </div>
          </div>)}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Open Tickets</h2>
              <p className="text-slate-400 mt-1">Review pending bills and complete payments quickly.</p>
            </div>
            <div className="text-sm text-slate-500">
              Updated every few seconds for real-time cashier processing.
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Total Outstanding</p>
              <p className="text-2xl font-semibold text-amber-400">KES {totalOutstanding.toFixed(2)}</p>
            </div>
          </div>

          {loading ? (<div className="flex justify-center items-center py-20">
              <lucide_react_1.Loader className="animate-spin text-slate-400" size={44}/>
            </div>) : bills.length === 0 ? (<div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
              No pending bills at this time.
            </div>) : (<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {bills.map(function (bill) { return (<div key={bill.order_id} className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/20 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Order #{bill.order_id}</p>
                      <p className="text-xl font-semibold text-white mt-2">Waiter: {bill.waiter_name && bill.waiter_name.trim() ? bill.waiter_name : (bill.waiter_id ? "ID: ".concat(bill.waiter_id) : '—')}</p>
                    </div>
                    <span className={"rounded-full px-3 py-1 text-xs font-semibold ".concat(bill.order_type === 'table' ? 'bg-sky-500/10 text-sky-300' : 'bg-orange-500/10 text-orange-300')}>
                      {bill.order_type === 'table' ? 'Dine-in' : 'Takeaway'}
                    </span>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between text-slate-400 text-sm mb-3">
                        <span>Items</span>
                        <span>{bill.items.length} total</span>
                      </div>
                      <div className="space-y-2">
                        {bill.items.map(function (item, idx) { return (<div key={idx} className="flex justify-between text-slate-200 text-sm">
                            <span>{(item.item_name || item.name)} x{item.quantity}</span>
                            <span>KES {(item.subtotal || ((item.unit_price || item.price) * item.quantity)).toFixed(2)}</span>
                          </div>); })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Total amount</p>
                        <p className="text-3xl font-semibold text-emerald-300">KES {bill.total_amount.toFixed(2)}</p>
                        {bill.phone && <p className="text-xs text-slate-500 mt-1">Phone: {bill.phone}</p>}
                      </div>
                      <button_1.Button onClick={function () { return handleConfirmPayment(bill); }} disabled={processingPayment && (selectedBill === null || selectedBill === void 0 ? void 0 : selectedBill.order_id) === bill.order_id} className="w-full sm:w-auto bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                        {processingPayment && (selectedBill === null || selectedBill === void 0 ? void 0 : selectedBill.order_id) === bill.order_id ? (<lucide_react_1.Loader className="animate-spin mr-2" size={16}/>) : null}
                        Confirm Payment
                      </button_1.Button>
                    </div>
                  </div>
                </div>); })}
            </div>)}
        </section>

        <dialog_1.Dialog open={showPaymentMethod} onOpenChange={setShowPaymentMethod}>
          <dialog_1.DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>
                {selectedBill ? "Order #".concat(selectedBill.order_id) : 'Select Payment Method'}
              </dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            {selectedBill && (<div className="space-y-4">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-lg text-white">Waiter: {selectedBill.waiter_name && selectedBill.waiter_name.trim() ? selectedBill.waiter_name : (selectedBill.waiter_id ? "ID: ".concat(selectedBill.waiter_id) : '—')}</p>
                  <p className="text-slate-400">Amount: <span className="font-bold text-2xl text-emerald-300">KES {selectedBill.total_amount.toFixed(2)}</span></p>
                  <p className="text-slate-500">{selectedBill.items.length} items</p>
                </div>
                <p className="text-sm font-semibold text-slate-300">Choose Payment Method:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button_1.Button onClick={function () {
                setShowPaymentMethod(false);
                setShowMpesaPrompt(true);
                setPaymentMethod('mpesa');
            }} disabled={processingPayment} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                    {processingPayment && paymentMethod === 'mpesa' ? (<lucide_react_1.Loader className="animate-spin mr-2" size={16}/>) : null}
                    M-Pesa
                  </button_1.Button>
                  <button_1.Button onClick={function () { return handleProcessPayment('cash'); }} disabled={processingPayment} className="bg-sky-500 text-slate-950 hover:bg-sky-400">
                    {processingPayment && paymentMethod === 'cash' ? (<lucide_react_1.Loader className="animate-spin mr-2" size={16}/>) : null}
                    Cash
                  </button_1.Button>
                </div>
              </div>)}
          </dialog_1.DialogContent>
        </dialog_1.Dialog>

        <dialog_1.Dialog open={showMpesaPrompt} onOpenChange={function (open) { if (!processingPayment)
        setShowMpesaPrompt(open); }}>
          <dialog_1.DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Enter M-Pesa Number</dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Enter customer's M-Pesa phone number to prompt payment (e.g. +254712345678, 0712345678, 712345678).</p>
              <div className="flex flex-col">
                <input value={mpesaNumber} onChange={function (e) { setMpesaNumber(e.target.value.replace(/\s+/g, '')); setMpesaError(null); }} onKeyDown={function (e) { if (e.key === 'Enter' && !processingPayment)
        handleProcessPayment('mpesa'); }} placeholder="e.g. +254712345678" disabled={processingPayment} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 disabled:opacity-50"/>
                {mpesaError && <p className="text-xs text-red-400 mt-2">{mpesaError}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button_1.Button onClick={function () { setShowMpesaPrompt(false); setMpesaNumber(''); setMpesaError(null); }} disabled={processingPayment} className="bg-red-600 text-white hover:bg-red-500 px-4 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
                  <lucide_react_1.X size={16}/>
                  Cancel
                </button_1.Button>
                <button_1.Button onClick={function () { return handleProcessPayment('mpesa'); }} disabled={processingPayment} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 px-4 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
                  {processingPayment && paymentMethod === 'mpesa' ? (<lucide_react_1.Loader className="animate-spin" size={16}/>) : null}
                  Send Payment Request
                </button_1.Button>
              </div>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>

        <dialog_1.Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <dialog_1.DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle className="flex items-center gap-2">
                <lucide_react_1.CheckCircle className="text-emerald-400" size={24}/>
                Payment Confirmed
              </dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            {receipt && (<div className="space-y-4">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-2 font-mono text-sm text-slate-200">
                  <p><strong>Order ID:</strong> {receipt.order_id}</p>
                  <p><strong>Waiter:</strong> {receipt.waiter_name}</p>
                  {receipt.waiter_id && <p><strong>Waiter ID:</strong> {receipt.waiter_id}</p>}
                  <p><strong>Type:</strong> {receipt.order_type}</p>
                  {receipt.phone && <p><strong>Phone:</strong> {receipt.phone}</p>}
                  <hr className="my-2 border-slate-800"/>
                  <p><strong>Total:</strong> KES {receipt.total_amount.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{receipt.timestamp}</p>
                </div>
              </div>)}
            <dialog_1.DialogFooter className="gap-2">
              <button_1.Button onClick={function () {
            setShowReceipt(false);
            setReceipt(null);
        }} className="bg-slate-700 text-white hover:bg-slate-600 px-4 py-3 rounded-xl font-bold shadow-lg transition-colors">
                Close
              </button_1.Button>
              <button_1.Button onClick={handlePrint} className="bg-sky-500 text-slate-950 hover:bg-sky-400">
                Print Receipt
              </button_1.Button>
            </dialog_1.DialogFooter>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
        <dialog_1.Dialog open={mpesaPolling} onOpenChange={setMpesaPolling}>
          <dialog_1.DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle className="flex items-center gap-2">
                <lucide_react_1.Loader className="animate-spin text-emerald-400" size={20}/>
                Waiting for customer confirmation
              </dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-400">A payment request was sent to the customer's phone. They should be prompted to enter their M-Pesa PIN.</p>
              {mpesaCheckoutId && <p className="text-xs text-slate-500">Checkout ID: {mpesaCheckoutId}</p>}
              <div className="flex justify-end gap-2">
                <button_1.Button onClick={function () {
            if (mpesaIntervalRef.current) {
                clearInterval(mpesaIntervalRef.current);
                mpesaIntervalRef.current = null;
            }
            setMpesaPolling(false);
            setMpesaCheckoutId(null);
            setProcessingPayment(false);
            setError('M-Pesa polling cancelled');
        }} className="bg-red-600 text-white hover:bg-red-500 px-4 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                  <lucide_react_1.X size={16}/>
                  Cancel Transaction
                </button_1.Button>
              </div>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>
    </div>);
}
