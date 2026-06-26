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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MENU_ITEMS = void 0;
var react_1 = require("react");
var staff_session_1 = require("@/lib/staff-session");
var lucide_react_1 = require("lucide-react");
var use_toast_1 = require("@/hooks/use-toast");
var Receipt_1 = require("./Receipt");
var api_1 = require("@/lib/api");
var image_1 = require("@/lib/image");
var utils_1 = require("@/lib/utils");
var Restaurant3DBackground_jsx_1 = require("../../Restaurant3DBackground.jsx");
exports.DEFAULT_MENU_ITEMS = [
    { name: "Classic Smash Burger", price: 750, category: "Burgers", popular: true, spicy: false, description: "Double patty, cheddar, pickles, special sauce" },
    { name: "Spicy Chicken Burger", price: 780, category: "Burgers", popular: false, spicy: true, description: "Crispy chicken, jalapeños, sriracha mayo" },
    { name: "BBQ Bacon Burger", price: 860, category: "Burgers", popular: true, spicy: false, description: "Smoked bacon, BBQ glaze, onion rings" },
    { name: "Veggie Deluxe", price: 690, category: "Burgers", popular: false, spicy: false, description: "Plant-based patty, avocado, fresh greens" },
    { name: "Loaded Fries", price: 360, category: "Sides", popular: true, spicy: false, description: "Cheese sauce, bacon bits, green onions" },
    { name: "Onion Rings", price: 280, category: "Sides", popular: false, spicy: false, description: "Beer-battered, crispy golden perfection" },
    { name: "Chicken Wings (8pc)", price: 720, category: "Sides", popular: true, spicy: false, description: "Choice of buffalo, BBQ, or garlic parmesan" },
    { name: "Coleslaw", price: 210, category: "Sides", popular: false, spicy: false, description: "Creamy homestyle coleslaw" },
    { name: "Classic Milkshake", price: 420, category: "Drinks", popular: true, spicy: false, description: "Vanilla, chocolate, or strawberry" },
    { name: "Fresh Lemonade", price: 290, category: "Drinks", popular: false, spicy: false, description: "Freshly squeezed with a hint of mint" },
    { name: "Iced Tea", price: 220, category: "Drinks", popular: false, spicy: false, description: "Brewed daily, sweetened or unsweetened" },
    { name: "Brownie Sundae", price: 460, category: "Desserts", popular: true, spicy: false, description: "Warm brownie, vanilla ice cream, hot fudge" },
    { name: "Apple Pie Bites", price: 330, category: "Desserts", popular: false, spicy: false, description: "Cinnamon sugar dusted, served warm" },
];
var categories = ["All", "Burgers", "Sides", "Drinks", "Desserts"];
var COMMON_MODIFIERS = ["No Onion", "Extra Cheese", "Extra Sauce", "Large", "Well Done", "No Sugar", "Extra Ice"];
var formatCurrency = function (value) {
    var currency = import.meta.env.VITE_CURRENCY_CODE || "KES";
    var locale = currency === "KES" ? "en-KE" : "en-US";
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency }).format(value);
};
var MenuSection = function () {
    var _a = (0, react_1.useState)("All"), active = _a[0], setActive = _a[1];
    var _b = (0, react_1.useState)(1), rate = _b[0], setRate = _b[1];
    var _c = (0, react_1.useState)(exports.DEFAULT_MENU_ITEMS), menuItems = _c[0], setMenuItems = _c[1];
    var _d = (0, react_1.useState)([]), sessionOrders = _d[0], setSessionOrders = _d[1];
    var _e = (0, react_1.useState)([]), cart = _e[0], setCart = _e[1];
    var _f = (0, react_1.useState)(null), activeItem = _f[0], setActiveItem = _f[1];
    var _g = (0, react_1.useState)(1), activeQuantity = _g[0], setActiveQuantity = _g[1];
    var _h = (0, react_1.useState)(""), activeModifiers = _h[0], setActiveModifiers = _h[1];
    var _j = (0, react_1.useState)(""), tableNumber = _j[0], setTableNumber = _j[1];
    var _k = (0, react_1.useState)("table"), orderType = _k[0], setOrderType = _k[1];
    var _l = (0, react_1.useState)("mpesa"), paymentMethod = _l[0], setPaymentMethod = _l[1];
    var _m = (0, react_1.useState)(""), phoneNumber = _m[0], setPhoneNumber = _m[1];
    var _o = (0, react_1.useState)(false), isQrFlow = _o[0], setIsQrFlow = _o[1];
    var _p = (0, react_1.useState)(""), deliveryAddress = _p[0], setDeliveryAddress = _p[1];
    var _q = (0, react_1.useState)(false), processing = _q[0], setProcessing = _q[1];
    var _r = (0, react_1.useState)(false), awaitingMpesaConfirm = _r[0], setAwaitingMpesaConfirm = _r[1];
    var _s = (0, react_1.useState)(null), lastOrder = _s[0], setLastOrder = _s[1];
    var _t = (0, react_1.useState)(null), currentOrderId = _t[0], setCurrentOrderId = _t[1];
    var pollTimerRef = (0, react_1.useRef)(null);
    var safetyTimeoutRef = (0, react_1.useRef)(null);
    var toast = (0, use_toast_1.useToast)().toast;
    var filtered = active === "All" ? menuItems : menuItems.filter(function (item) { return item.category === active; });
    (0, react_1.useEffect)(function () {
        var searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        var source = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get('source');
        if (source === 'qr') {
            setIsQrFlow(true);
            setPaymentMethod('mpesa');
        }
        var load = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, configRes, menuRes, d, md, fetchedItems, _b;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, Promise.all([
                                fetch((0, api_1.getApiUrl)("/payments/config/")),
                                fetch((0, api_1.getApiUrl)("/payments/menu-items/")),
                            ])];
                    case 1:
                        _a = _e.sent(), configRes = _a[0], menuRes = _a[1];
                        if (!configRes.ok) return [3 /*break*/, 3];
                        if (!((_c = configRes.headers.get("content-type")) === null || _c === void 0 ? void 0 : _c.includes("application/json")))
                            return [2 /*return*/];
                        return [4 /*yield*/, configRes.json()];
                    case 2:
                        d = _e.sent();
                        if (d === null || d === void 0 ? void 0 : d.conversion_rate)
                            setRate(d.conversion_rate);
                        _e.label = 3;
                    case 3:
                        if (!menuRes.ok) return [3 /*break*/, 5];
                        if (!((_d = menuRes.headers.get("content-type")) === null || _d === void 0 ? void 0 : _d.includes("application/json")))
                            return [2 /*return*/];
                        return [4 /*yield*/, menuRes.json()];
                    case 4:
                        md = _e.sent();
                        fetchedItems = Array.isArray(md === null || md === void 0 ? void 0 : md.menu_items) ? md.menu_items : [];
                        if (fetchedItems.length > 0) {
                            setMenuItems(fetchedItems);
                        }
                        _e.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        _b = _e.sent();
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        }); };
        load();
    }, []);
    // Cleanup timers on component unmount
    (0, react_1.useEffect)(function () {
        return function () {
            if (pollTimerRef.current)
                window.clearTimeout(pollTimerRef.current);
            if (safetyTimeoutRef.current)
                window.clearTimeout(safetyTimeoutRef.current);
        };
    }, []);
    var handleCancelTransaction = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (pollTimerRef.current) {
                window.clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            if (safetyTimeoutRef.current) {
                window.clearTimeout(safetyTimeoutRef.current);
                safetyTimeoutRef.current = null;
            }
            if (currentOrderId) {
                fetch((0, api_1.getApiUrl)("/payments/orders/".concat(encodeURIComponent(currentOrderId), "/discard/")), { method: 'DELETE' }).catch(function () { });
            }
            setProcessing(false);
            setCurrentOrderId(null);
            setAwaitingMpesaConfirm(false);
            toast({
                title: "Transaction Cancelled",
                description: "The payment process has been stopped and the order discarded.",
                variant: "destructive",
            });
            return [2 /*return*/];
        });
    }); };
    var openAddItem = function (itemName) {
        setActiveItem(itemName);
        setActiveQuantity(1);
        setActiveModifiers("");
    };
    var resetForm = function () {
        setCart([]);
        setSessionOrders([]);
        setTableNumber("");
        setDeliveryAddress("");
        setPhoneNumber("");
        setCurrentOrderId(null);
    };
    var addItemToCart = function (itemName) {
        var menuItem = menuItems.find(function (item) { return item.name === itemName; });
        if (!menuItem) {
            toast({ title: "Item not found", description: "Could not add this item to the cart." });
            return;
        }
        setCart(function (current) { return __spreadArray(__spreadArray([], current, true), [
            {
                name: menuItem.name,
                price: menuItem.price,
                menu_item_id: menuItem.id,
                quantity: Math.max(1, activeQuantity),
                modifiers: activeModifiers
                    .split(",")
                    .map(function (modifier) { return modifier.trim(); })
                    .filter(Boolean),
            },
        ], false); });
        setActiveItem(null);
        setActiveModifiers("");
        setActiveQuantity(1);
    };
    var toggleModifier = function (mod) {
        var currentMods = activeModifiers.split(",").map(function (m) { return m.trim(); }).filter(Boolean);
        if (currentMods.includes(mod)) {
            setActiveModifiers(currentMods.filter(function (m) { return m !== mod; }).join(", "));
        }
        else {
            var updated = __spreadArray(__spreadArray([], currentMods, true), [mod], false);
            setActiveModifiers(updated.join(", "));
        }
    };
    var removeCartItem = function (index) {
        setCart(function (current) { return current.filter(function (_, idx) { return idx !== index; }); });
    };
    var removeSessionOrder = function (index) {
        setSessionOrders(function (current) { return current.filter(function (_, idx) { return idx !== index; }); });
    };
    var addCartToSession = function () {
        if (cart.length === 0)
            return;
        setSessionOrders(__spreadArray(__spreadArray([], sessionOrders, true), [cart], false));
        setCart([]);
        toast({ title: "Order Group Saved", description: "The current items have been added to the consolidated bill." });
    };
    var sessionSubtotal = sessionOrders.reduce(function (sum, order) {
        return sum + order.reduce(function (s, i) { return s + (i.price * i.quantity); }, 0);
    }, 0);
    var cartSubtotal = cart.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
    var foodSubtotal = sessionSubtotal + cartSubtotal;
    var totalBeforePayment = foodSubtotal * rate;
    var handleCreateOrder = function () { return __awaiter(void 0, void 0, void 0, function () {
        var cleanedPhone, allItems, response, data_1, errorMessage, receiptData_1, checkoutId_1, transactionSettled_1, checkPaymentStatus_1, error_1, message;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (cart.length === 0 && sessionOrders.length === 0) {
                        toast({ title: "Add items first", description: "Build a cart before creating an order." });
                        return [2 /*return*/];
                    }
                    if (orderType === "table" && !tableNumber.trim()) {
                        toast({ title: "Table number required", description: "Enter the table number for this order." });
                        return [2 /*return*/];
                    }
                    if (orderType === "delivery" && !deliveryAddress.trim()) {
                        toast({ title: "Delivery address required", description: "Enter the address for this order." });
                        return [2 /*return*/];
                    }
                    if (paymentMethod === "mpesa" && !phoneNumber.trim()) {
                        toast({ title: "Phone number required", description: "Enter your M-Pesa phone number to initiate payment." });
                        return [2 /*return*/];
                    }
                    cleanedPhone = (0, utils_1.normalizePhoneNumber)(phoneNumber);
                    if (paymentMethod === "mpesa" && !(0, utils_1.isValidMpesaPhone)(phoneNumber)) {
                        toast({ title: "Invalid phone number", description: "Enter a Kenyan M-Pesa number like +254712345678, 0712345678, or 712345678." });
                        return [2 /*return*/];
                    }
                    setLastOrder(null);
                    setProcessing(true);
                    allItems = __spreadArray(__spreadArray([], sessionOrders.flatMap(function (o) { return o; }), true), cart, true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/pos/create-order/"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                items: allItems.map(function (item) { return ({
                                    menu_item_id: item.menu_item_id || item.id || undefined,
                                    name: item.name,
                                    price: item.price,
                                    quantity: item.quantity,
                                    modifiers: item.modifiers,
                                    seat_number: 1,
                                }); }),
                                table_number: orderType === "table" ? tableNumber.trim() : "",
                                delivery_address: orderType === "delivery" ? deliveryAddress.trim() : "",
                                split_count: 1,
                                phone: cleanedPhone,
                                split_phones: [],
                                order_type: orderType,
                                payment_method: paymentMethod,
                                waiter_name: (0, staff_session_1.getStaffName)() || undefined,
                                waiter_id: (0, staff_session_1.getStaffId)() || undefined,
                            }),
                        })];
                case 2:
                    response = _c.sent();
                    if (!((_a = response.headers.get("content-type")) === null || _a === void 0 ? void 0 : _a.includes("application/json"))) {
                        toast({ title: "Server Error", description: "Invalid response from server during order creation.", variant: "destructive" });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, response.json().catch(function () { return null; })];
                case 3:
                    data_1 = _c.sent();
                    if (!response.ok) {
                        errorMessage = (data_1 === null || data_1 === void 0 ? void 0 : data_1.error) || (data_1 === null || data_1 === void 0 ? void 0 : data_1.message) || "Internal Server Error";
                        toast({ title: "Order failed", description: errorMessage });
                        return [2 /*return*/];
                    }
                    setCurrentOrderId(data_1.order_id);
                    receiptData_1 = __assign(__assign({}, data_1), { items: allItems, total_amount: data_1.total_amount || totalBeforePayment, cashier_notified: true });
                    if (paymentMethod === "mpesa") {
                        if (!((_b = data_1.stk_response) === null || _b === void 0 ? void 0 : _b.CheckoutRequestID)) {
                            toast({ title: "System Busy", description: "The payment gateway is currently handling high traffic. Please try again.", variant: "destructive" });
                            setProcessing(false);
                            setCurrentOrderId(null);
                            fetch((0, api_1.getApiUrl)("/payments/orders/".concat(encodeURIComponent(data_1.order_id), "/discard/")), { method: 'DELETE' }).catch(function () { });
                            return [2 /*return*/];
                        }
                        checkoutId_1 = data_1.stk_response.CheckoutRequestID;
                        setProcessing(false);
                        setAwaitingMpesaConfirm(true);
                        transactionSettled_1 = false;
                        toast({
                            title: "Awaiting Confirmation",
                            description: "Please complete the M-Pesa prompt on your phone to generate your receipt.",
                        });
                        checkPaymentStatus_1 = function () { return __awaiter(void 0, void 0, void 0, function () {
                            var statusRes, statusData, e_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (transactionSettled_1 || !pollTimerRef.current)
                                            return [2 /*return*/];
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 5, , 6]);
                                        return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/status/?checkout_id=".concat(checkoutId_1)))];
                                    case 2:
                                        statusRes = _a.sent();
                                        if (!statusRes.ok) return [3 /*break*/, 4];
                                        return [4 /*yield*/, statusRes.json()];
                                    case 3:
                                        statusData = _a.sent();
                                        if (statusData.status === "success") {
                                            transactionSettled_1 = true;
                                            if (pollTimerRef.current)
                                                window.clearTimeout(pollTimerRef.current);
                                            pollTimerRef.current = null;
                                            if (safetyTimeoutRef.current) {
                                                window.clearTimeout(safetyTimeoutRef.current);
                                                safetyTimeoutRef.current = null;
                                            }
                                            setProcessing(false);
                                            setAwaitingMpesaConfirm(false);
                                            setCurrentOrderId(null);
                                            setLastOrder(receiptData_1);
                                            toast({ title: "Payment Confirmed", description: "Receipt generated successfully." });
                                            resetForm();
                                            return [2 /*return*/];
                                        }
                                        if (statusData.status === "failed" || statusData.status === "error") {
                                            transactionSettled_1 = true;
                                            if (pollTimerRef.current)
                                                window.clearTimeout(pollTimerRef.current);
                                            pollTimerRef.current = null;
                                            if (safetyTimeoutRef.current) {
                                                window.clearTimeout(safetyTimeoutRef.current);
                                                safetyTimeoutRef.current = null;
                                            }
                                            setProcessing(false);
                                            setAwaitingMpesaConfirm(false);
                                            setCurrentOrderId(null);
                                            toast({
                                                title: "Payment Failed",
                                                description: "Transaction for order ".concat(data_1.order_id, " was unsuccessful. The order has been discarded."),
                                                variant: "destructive",
                                            });
                                            return [2 /*return*/];
                                        }
                                        _a.label = 4;
                                    case 4: return [3 /*break*/, 6];
                                    case 5:
                                        e_1 = _a.sent();
                                        return [3 /*break*/, 6];
                                    case 6:
                                        if (!transactionSettled_1 && pollTimerRef.current) {
                                            pollTimerRef.current = window.setTimeout(checkPaymentStatus_1, 500);
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        // Start polling quickly to catch the callback as soon as it arrives.
                        pollTimerRef.current = window.setTimeout(checkPaymentStatus_1, 200);
                        // 1-minute safety timeout to stop polling and discard uncompleted transaction
                        safetyTimeoutRef.current = window.setTimeout(function () {
                            if (!transactionSettled_1) {
                                if (pollTimerRef.current)
                                    window.clearTimeout(pollTimerRef.current);
                                pollTimerRef.current = null;
                                safetyTimeoutRef.current = null;
                                setProcessing(false);
                                setAwaitingMpesaConfirm(false);
                                setCurrentOrderId(null);
                                toast({
                                    title: "Payment Timeout",
                                    description: "The payment window has expired. The order has been cancelled.",
                                    variant: "destructive",
                                });
                            }
                        }, 60000); // 60 seconds is typical for STK Push expiry
                    }
                    else {
                        // Cash payment - generate immediately as it is considered settled
                        setAwaitingMpesaConfirm(false);
                        setLastOrder(__assign(__assign({}, receiptData_1), { cashier_notified: true }));
                        toast({
                            title: "Order created",
                            description: "Order ".concat(data_1.order_id, " created and marked as paid via Cash."),
                        });
                        resetForm();
                        setCurrentOrderId(null);
                        setProcessing(false);
                    }
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _c.sent();
                    message = error_1 instanceof Error ? error_1.message : String(error_1);
                    toast({ title: "Order error", description: "Unable to reach backend: ".concat(message) });
                    setProcessing(false);
                    setAwaitingMpesaConfirm(false);
                    return [3 /*break*/, 6];
                case 5: return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (<section id="menu" className="py-24 bg-gradient-to-br from-gray-900 to-slate-800 text-slate-200 relative overflow-hidden scroll-mt-20">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Restaurant3DBackground_jsx_1.default />
      </div>
      {lastOrder && (<Receipt_1.default order={lastOrder} onClose={function () { return setLastOrder(null); }}/>)}
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Our Menu</p>
          <h2 className="font-display text-5xl md:text-6xl text-slate-100">TABLE-BASED POS</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map(function (cat) { return (<button key={cat} onClick={function () { return setActive(cat); }} className={"px-6 py-2 rounded-full text-sm font-semibold transition-all ".concat(active === cat
                ? "bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 shadow-lg"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800")}>
              {cat}
            </button>); })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map(function (item) { return (<div key={item.name} className="bg-slate-900 rounded-xl p-6 shadow-card hover:shadow-[#d69e2e]/10 transition-shadow border border-slate-800 group">
                <div className="flex flex-col gap-3 mb-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl text-slate-100 group-hover:text-primary transition-colors break-words">
                      {item.name}
                    </h3>
                    {item.sku && <span className="block text-xs text-slate-500 mt-1">{"SKU: ".concat(item.sku)}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.spicy && <lucide_react_1.Flame className="w-4 h-4 text-primary"/>}
                    {item.popular && <lucide_react_1.BadgeCheck className="w-4 h-4 text-secondary"/>}
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-4">{item.description}</p>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 items-center gap-4 min-w-0">
                    {item.image_url && <img src={(0, image_1.formatImageUrl)(item.image_url)} alt={item.name} className="w-16 h-16 object-cover rounded-lg"/>}
                    <span className="font-display text-3xl text-gradient break-words">{formatCurrency(item.price * rate)}</span>
                  </div>

                  {activeItem === item.name ? (<div className="flex flex-col gap-3 w-full max-w-sm">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Quantity</label>
                          <input type="number" min={1} value={activeQuantity} onChange={function (event) { return setActiveQuantity(Number(event.target.value) || 1); }} className="w-20 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary"/>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_MODIFIERS.map(function (mod) {
                    var isSelected = activeModifiers.split(",").map(function (m) { return m.trim(); }).filter(Boolean).includes(mod);
                    return (<button key={mod} type="button" onClick={function () { return toggleModifier(mod); }} className={"px-3 py-1 rounded-full text-[10px] font-bold transition-all border ".concat(isSelected
                            ? "bg-[#d69e2e] text-[#1a365d] border-[#d69e2e] shadow-md shadow-[#d69e2e]/20"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500")}>
                                {mod}
                              </button>);
                })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={function () { return addItemToCart(item.name); }} className="bg-[#0A1A2F] text-[#C9A961] border border-[#C9A961]/30 px-4 py-2 rounded-full text-sm font-semibold hover:scale-105 transition-transform">
                          Add to Cart
                        </button>
                        <button type="button" onClick={function () { return setActiveItem(null); }} className="rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm font-semibold text-[#E5E7EB] hover:bg-[#0A1A2F] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>) : (<button type="button" onClick={function () { return openAddItem(item.name); }} className="bg-[#0A1A2F] text-[#C9A961] border border-[#C9A961]/30 px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105">
                      Add to Cart
                    </button>)}
                </div>
              </div>); })}
          </div>
          <aside className="bg-[#1F2937] rounded-xl p-6 shadow-card border border-[#1F2937]">
            <div className="mb-6">
              <p className="text-sm text-[#E5E7EB]">Session Management</p>
              <h3 className="font-display text-2xl text-[#E5E7EB]">Table Billing</h3>
            </div>
            {cart.length === 0 && sessionOrders.length === 0 ? (<p className="text-[#E5E7EB]">Select items and build a multi-order session.</p>) : (<div className="space-y-4">
                {sessionOrders.map(function (orderItems, oIdx) { return (<div key={oIdx} className="rounded-xl border-l-4 border-[#C9A961] p-4 bg-[#0A1A2F]/50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-bold text-[#C9A961] uppercase tracking-tighter">Saved Group #{oIdx + 1}</p>
                      <button onClick={function () { return removeSessionOrder(oIdx); }} className="text-[10px] text-destructive hover:underline">Discard Group</button>
                    </div>
                    {orderItems.map(function (item, iIdx) { return (<div key={iIdx} className="flex justify-between text-xs text-slate-300">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>); })}
                  </div>); })}
                {cart.length > 0 && (<div className="space-y-3">
                    <p className="text-[10px] font-bold text-[#E5E7EB] uppercase">Active Selection</p>
                    {cart.map(function (item, index) { return (<div key={"".concat(item.name, "-").concat(index)} className="rounded-xl border border-[#1F2937] p-4 bg-[#0A1A2F]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#E5E7EB]">{item.name}</p>
                            <p className="text-sm text-[#E5E7EB]">
                              {item.quantity} x {formatCurrency(item.price)}
                            </p>
                            {item.modifiers.length > 0 && (<p className="text-xs text-[#E5E7EB] mt-1">Modifiers: {item.modifiers.join(", ")}</p>)}
                          </div>
                          <button type="button" onClick={function () { return removeCartItem(index); }} className="text-sm text-destructive">
                            Remove
                          </button>
                        </div>
                      </div>); })}
                    <button type="button" onClick={addCartToSession} className="w-full rounded-full border border-[#C9A961] text-[#C9A961] py-2 text-xs font-bold hover:bg-[#C9A961] hover:text-[#0A1A2F] transition-all">
                      Add to Grouped Bill
                    </button>
                  </div>)}
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#E5E7EB]">Order Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {["table", "takeaway", "delivery"].map(function (type) { return (<button key={type} type="button" onClick={function () { return setOrderType(type); }} className={"flex-1 min-w-[80px] rounded-full px-4 py-2 text-xs font-semibold border transition-all ".concat(orderType === type ? "bg-[#C9A961] text-[#0A1A2F] border-[#C9A961]" : "bg-[#1F2937] text-[#E5E7EB] border-[#1F2937] hover:bg-[#0A1A2F]")}>
                          {type === "table" ? "Dine In" : type === "takeaway" ? "Takeaway" : "Delivery"}
                        </button>); })}
                    </div>
                  </div>
                  {orderType === "table" && (<div className="space-y-1">
                      <label className="text-sm font-semibold text-[#E5E7EB]">Table Number</label>
                      <input type="text" value={tableNumber} onChange={function (event) { return setTableNumber(event.target.value); }} placeholder="e.g. 3" className="w-full rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm text-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#C9A961]"/>
                    </div>)}
                  {orderType === "delivery" && (<div className="space-y-1">
                      <label className="text-sm font-semibold text-[#E5E7EB]">Delivery Address <span className="text-destructive">*</span></label>
                      <input type="text" value={deliveryAddress} onChange={function (event) { return setDeliveryAddress(event.target.value); }} placeholder="e.g. Near university gate, yellow house..." className="w-full rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm text-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#C9A961]"/>
                    </div>)}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#E5E7EB]">Payment Method</label>
                    <div className="flex gap-2">
                      {(isQrFlow ? ["mpesa"] : ["mpesa", "cash"]).map(function (method) { return (<button key={method} type="button" onClick={function () { return setPaymentMethod(method); }} className={"flex-1 rounded-full px-4 py-2 text-xs font-semibold border transition-all ".concat(paymentMethod === method ? "bg-[#C9A961] text-[#0A1A2F] border-[#C9A961]" : "bg-[#1F2937] text-[#E5E7EB] border-[#1F2937] hover:bg-[#0A1A2F]")}>
                          {method === "mpesa" ? "M-Pesa" : "Cash"}
                        </button>); })}
                    </div>
                    {isQrFlow && (<p className="text-xs text-amber-300">QR orders must be paid via M-Pesa only.</p>)}
                  </div>
                  <label className="text-sm font-semibold text-[#E5E7EB]">
                    {paymentMethod === "mpesa" ? "M-Pesa Phone" : "Phone (optional)"}
                    {paymentMethod === "mpesa" && <span className="text-destructive"> *</span>}
                  </label>
                  
                  <input type="tel" value={phoneNumber} onChange={function (e) { return setPhoneNumber(e.target.value); }} placeholder="2547XXXXXXXX" className="w-full rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm text-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#C9A961]"/>
                </div>
                <div className="space-y-2 pt-4 border-t border-[#1F2937]">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Order Review</p>
                  <div className="flex items-center justify-between text-sm text-[#E5E7EB]">
                    <span>Food Total</span>
                    <span>{formatCurrency(foodSubtotal * rate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold text-[#E5E7EB] pt-2 border-t border-[#1F2937]">
                    <span>Total</span>
                      <span className="text-[#C9A961]">
                      {formatCurrency(totalBeforePayment)}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, handleCreateOrder()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); }} disabled={processing || awaitingMpesaConfirm} className="w-full rounded-full bg-[#0A1A2F] text-[#C9A961] border border-[#C9A961]/30 px-5 py-3 text-sm font-semibold transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70">
                  {processing ? "Initiating payment..." : awaitingMpesaConfirm ? 'Awaiting M-Pesa confirmation...' : "Pay ".concat(formatCurrency(totalBeforePayment))}
                </button>
                {processing && paymentMethod === "mpesa" && (<button type="button" onClick={handleCancelTransaction} className="w-full mt-2 rounded-full border border-red-500/50 text-red-500 py-2 text-xs font-bold hover:bg-red-500 hover:text-white transition-all">
                    Cancel Transaction
                  </button>)}
              </div>)}
          </aside>
        </div>
      </div>
    </section>);
};
exports.default = MenuSection;
