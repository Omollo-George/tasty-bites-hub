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
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var api_1 = require("@/lib/api");
var react_router_dom_1 = require("react-router-dom");
var sonner_1 = require("sonner");
var image_1 = require("@/lib/image");
var utils_1 = require("@/lib/utils");
var CartModal_1 = require("./CartModal");
var utils_2 = require("./utils");
var Receipt_1 = require("./Receipt");
var hero_food_jpg_1 = require("@/assets/hero-food.jpg");
var About_1 = require("./About");
var Contact_1 = require("./Contact");
var Footer_1 = require("./Footer");
var DEFAULT_MENU_ITEMS = [
    {
        id: 1,
        name: 'Classic Smash Burger',
        description: 'Double patty, cheddar, pickles, special sauce',
        price: 750,
        category: 'Burgers',
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
        popular: true,
        spicy: false,
        is_available: true,
    },
    {
        id: 2,
        name: 'Spicy Chicken Burger',
        description: 'Crispy chicken, jalapeños, sriracha mayo',
        price: 780,
        category: 'Burgers',
        image_url: 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=500&q=80',
        popular: false,
        spicy: true,
        is_available: true,
    },
    {
        id: 3,
        name: 'BBQ Bacon Burger',
        description: 'Smoked bacon, BBQ glaze, onion rings',
        price: 860,
        category: 'Burgers',
        image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80',
        popular: true,
        spicy: false,
        is_available: true,
    },
    {
        id: 4,
        name: 'Veggie Deluxe',
        description: 'Plant-based patty, avocado, fresh greens',
        price: 690,
        category: 'Burgers',
        image_url: 'https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=500&q=80',
        popular: false,
        spicy: false,
        is_available: true,
    },
    {
        id: 5,
        name: 'Loaded Fries',
        description: 'Cheese sauce, bacon bits, green onions',
        price: 360,
        category: 'Sides',
        image_url: 'https://images.unsplash.com/photo-1573015084185-7205ba3d6ea8?w=500&q=80',
        popular: true,
        spicy: false,
        is_available: true,
    },
    {
        id: 6,
        name: 'Onion Rings',
        description: 'Beer-battered, crispy golden perfection',
        price: 280,
        category: 'Sides',
        image_url: 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=500&q=80',
        popular: false,
        spicy: false,
        is_available: true,
    },
    {
        id: 7,
        name: 'Chicken Wings (8pc)',
        description: 'Choice of buffalo, BBQ, or garlic parmesan',
        price: 720,
        category: 'Sides',
        image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80',
        popular: true,
        spicy: false,
        is_available: true,
    },
    {
        id: 8,
        name: 'Coleslaw',
        description: 'Creamy homestyle coleslaw',
        price: 210,
        category: 'Sides',
        image_url: 'https://images.unsplash.com/photo-1481833761820-0509d3217039?w=500&q=80',
        popular: false,
        spicy: false,
        is_available: true,
    },
    {
        id: 9,
        name: 'Classic Milkshake',
        description: 'Vanilla, chocolate, or strawberry',
        price: 420,
        category: 'Drinks',
        image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80',
        popular: true,
        spicy: false,
        is_available: true,
    },
    {
        id: 10,
        name: 'Fresh Lemonade',
        description: 'Freshly squeezed with a hint of mint',
        price: 290,
        category: 'Drinks',
        image_url: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=500&q=80',
        popular: false,
        spicy: false,
        is_available: true,
    },
    {
        id: 11,
        name: 'Iced Tea',
        description: 'Brewed daily, sweetened or unsweetened',
        price: 220,
        category: 'Drinks',
        image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80',
        popular: false,
        spicy: false,
        is_available: true,
    },
    {
        id: 12,
        name: 'Brownie Sundae',
        description: 'Warm brownie, vanilla ice cream, hot fudge',
        price: 460,
        category: 'Desserts',
        image_url: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=500&q=80',
        popular: true,
        spicy: false,
        is_available: true,
    },
    {
        id: 13,
        name: 'Apple Pie Bites',
        description: 'Cinnamon sugar dusted, served warm',
        price: 330,
        category: 'Desserts',
        image_url: 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=500&q=80',
        popular: false,
        spicy: false,
        is_available: true,
    },
];
var DEFAULT_CATEGORIES = ['Burgers', 'Sides', 'Drinks', 'Desserts'];
var buildDefaultHomeData = function () {
    var menuByCategory = DEFAULT_CATEGORIES.reduce(function (acc, category) {
        acc[category] = DEFAULT_MENU_ITEMS.filter(function (item) { return item.category === category; });
        return acc;
    }, {});
    return {
        hero: {
            title: 'TASTY BITES HUB',
            tagline: 'CRAFTED WITH PASSION, DELIVERED WITH PRECISION.',
            image_url: 'https://images.unsplash.com/photo-1514356015730-0739d598061f?q=80&w=1600',
        },
        categories: DEFAULT_CATEGORIES,
        featured: DEFAULT_MENU_ITEMS.filter(function (item) { return item.popular; }).slice(0, 5),
        menu_by_category: menuByCategory,
        config: {
            currency: 'KES',
            delivery_min: 0,
        },
    };
};
var DEFAULT_HOME_DATA = buildDefaultHomeData();
var ProfessionalCustomerHome = function () {
    var _a = (0, react_1.useState)(DEFAULT_HOME_DATA), data = _a[0], setData = _a[1];
    var _b = (0, react_1.useState)(false), scrolled = _b[0], setScrolled = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)([]), cart = _e[0], setCart = _e[1]; // Cart state
    var _f = (0, react_1.useState)(''), phoneNumber = _f[0], setPhoneNumber = _f[1];
    var _g = (0, react_1.useState)(''), searchQuery = _g[0], setSearchQuery = _g[1];
    var _h = (0, react_1.useState)([]), suggestions = _h[0], setSuggestions = _h[1];
    var _j = (0, react_1.useState)(-1), activeSuggestion = _j[0], setActiveSuggestion = _j[1];
    var _k = (0, react_1.useState)(false), showCartModal = _k[0], setShowCartModal = _k[1]; // State to control cart modal visibility
    var _l = (0, react_1.useState)(null), lastOrder = _l[0], setLastOrder = _l[1]; // State to show receipt after checkout
    var _m = (0, react_1.useState)(false), processing = _m[0], setProcessing = _m[1];
    var _o = (0, react_1.useState)(false), awaitingMpesaConfirm = _o[0], setAwaitingMpesaConfirm = _o[1];
    var _p = (0, react_1.useState)(null), currentOrderId = _p[0], setCurrentOrderId = _p[1]; // To track order for cancellation
    var _q = (0, react_1.useState)(function () { return parseInt(localStorage.getItem('loyaltyPoints') || '0'); }), points = _q[0], setPoints = _q[1];
    var _r = (0, react_1.useState)('takeaway'), orderType = _r[0], setOrderType = _r[1];
    var _s = (0, react_1.useState)(''), deliveryAddress = _s[0], setDeliveryAddress = _s[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    var pollTimerRef = (0, react_1.useRef)(null);
    var safetyTimeoutRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var handleScroll = function () { return setScrolled(window.scrollY > 50); };
        window.addEventListener('scroll', handleScroll);
        var fetchData = function () { return __awaiter(void 0, void 0, void 0, function () {
            var homeRes, text, homeJson, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, 6, 7]);
                        return [4 /*yield*/, fetch((0, api_1.getApiUrl)('/payments/customer/home/'))];
                    case 1:
                        homeRes = _a.sent();
                        if (!!homeRes.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, homeRes.text().catch(function () { return ''; })];
                    case 2:
                        text = _a.sent();
                        console.error('customer_home failed response:', homeRes.status, text);
                        setError("HTTP error! status: ".concat(homeRes.status, " from home data"));
                        return [2 /*return*/];
                    case 3: return [4 /*yield*/, homeRes.json()];
                    case 4:
                        homeJson = _a.sent();
                        if (!homeJson || !homeJson.menu_by_category) {
                            console.error('customer_home returned invalid payload:', homeJson);
                            setError('Invalid menu response from backend. Showing fallback menu.');
                            return [2 /*return*/];
                        }
                        setData(homeJson);
                        return [3 /*break*/, 7];
                    case 5:
                        err_1 = _a.sent();
                        setError(err_1.message || "Failed to fetch data. Check backend connection.");
                        return [3 /*break*/, 7];
                    case 6:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        }); };
        fetchData();
        return function () {
            window.removeEventListener('scroll', handleScroll);
            if (pollTimerRef.current)
                clearTimeout(pollTimerRef.current);
            if (safetyTimeoutRef.current)
                clearTimeout(safetyTimeoutRef.current);
        };
    }, []);
    // Lock scroll on both body and html to ensure background is strictly static
    (0, react_1.useEffect)(function () {
        if (showCartModal || lastOrder) {
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
        }
        else {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = 'unset';
        }
        return function () {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
        };
    }, [showCartModal, lastOrder]);
    var scrollToTop = function () {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    var clearTimers = function () {
        if (pollTimerRef.current)
            clearTimeout(pollTimerRef.current);
        if (safetyTimeoutRef.current)
            clearTimeout(safetyTimeoutRef.current);
        pollTimerRef.current = null;
        safetyTimeoutRef.current = null;
    };
    var scrollToCategory = function (category) {
        var element = document.getElementById("category-".concat(category));
        if (element) {
            var offset = 100;
            var bodyRect = document.body.getBoundingClientRect().top;
            var elementRect = element.getBoundingClientRect().top;
            var elementPosition = elementRect - bodyRect;
            var offsetPosition = elementPosition - offset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };
    var allMenuItems = (0, react_1.useMemo)(function () {
        if (!data)
            return [];
        return Object.values(data.menu_by_category).flat();
    }, [data]);
    (0, react_1.useEffect)(function () {
        var q = searchQuery.trim().toLowerCase();
        if (!q) {
            setSuggestions([]);
            setActiveSuggestion(-1);
            return;
        }
        var matches = allMenuItems
            .filter(function (it) { return it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q); })
            .slice(0, 8);
        setSuggestions(matches);
        setActiveSuggestion(-1);
    }, [searchQuery, allMenuItems]);
    var handleRewardsClick = function () {
        sonner_1.toast.info("Your Loyalty Status", {
            description: "You currently have ".concat(points, " points. Earn 10 points on orders above ").concat((0, utils_2.formatCurrency)(1000, (data === null || data === void 0 ? void 0 : data.config.currency) || 'KES'), ". Redeem 100 points for a free drink!"),
            icon: <lucide_react_1.Star className="text-orange-500" size={16}/>
        });
    };
    var handleAddToCart = function (item) {
        setCart(function (prevCart) {
            var existingItem = prevCart.find(function (cartItem) { return cartItem.id === item.id; });
            var newQuantity = 1;
            var newCart;
            if (existingItem) {
                newCart = prevCart.map(function (cartItem) {
                    return cartItem.id === item.id
                        ? __assign(__assign({}, cartItem), { quantity: cartItem.quantity + 1 }) : cartItem;
                });
                newQuantity = existingItem.quantity + 1;
            }
            else {
                newCart = __spreadArray(__spreadArray([], prevCart, true), [
                    {
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: 1,
                        image_url: item.image_url,
                        is_available: item.is_available,
                    },
                ], false);
            }
            sonner_1.toast.success("".concat(item.name, " added to cart!"), {
                description: "You now have ".concat(newQuantity, " of this item."),
                action: {
                    label: "View Cart",
                    onClick: function () { return setShowCartModal(true); }
                },
            });
            return newCart;
        });
    };
    var handleUpdateQuantity = function (itemId, newQuantity) {
        setCart(function (prevCart) {
            var existingItem = prevCart.find(function (cartItem) { return cartItem.id === itemId; });
            if (!existingItem)
                return prevCart;
            if (newQuantity <= 0) {
                return prevCart.filter(function (cartItem) { return cartItem.id !== itemId; });
            }
            return prevCart.map(function (cartItem) {
                return cartItem.id === itemId
                    ? __assign(__assign({}, cartItem), { quantity: newQuantity }) : cartItem;
            });
        });
    };
    var handleRemoveItem = function (itemId) {
        setCart(function (prevCart) { return prevCart.filter(function (cartItem) { return cartItem.id !== itemId; }); });
        sonner_1.toast.info("Item removed from cart.");
    };
    var cartTotalItems = (0, react_1.useMemo)(function () { return cart.reduce(function (total, item) { return total + item.quantity; }, 0); }, [cart]);
    var cartTotalPrice = (0, react_1.useMemo)(function () { return cart.reduce(function (total, item) { return total + (item.price * item.quantity); }, 0); }, [cart]);
    var featuredIds = (0, react_1.useMemo)(function () { var _a; return new Set((_a = data === null || data === void 0 ? void 0 : data.featured.map(function (item) { return item.id; })) !== null && _a !== void 0 ? _a : []); }, [data]);
    var handleRedeemPoints = function () {
        if (points < 100) {
            sonner_1.toast.error("Insufficient Points", { description: "You need at least 100 points to redeem a free drink." });
            return;
        }
        var newPoints = points - 100;
        setPoints(newPoints);
        localStorage.setItem('loyaltyPoints', newPoints.toString());
        sonner_1.toast.success("Points Redeemed!", {
            description: "100 points deducted. A free drink credit has been applied to your profile/order.",
            icon: <lucide_react_1.Star className="text-orange-500" size={16}/>
        });
    };
    var handleCheckout = function () { return __awaiter(void 0, void 0, void 0, function () {
        var cleanedPhone, response, dataRes, errorMessage, checkoutId_1, transactionSettled_1, checkPaymentStatus_1, err_2, message;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (cart.length === 0) {
                        sonner_1.toast.error("Your cart is empty!", { description: "Add some delicious items before checking out." });
                        return [2 /*return*/];
                    }
                    if (!phoneNumber.trim()) {
                        sonner_1.toast.error("Phone number required", { description: "Enter your M-Pesa number to pay." });
                        return [2 /*return*/];
                    }
                    if (orderType === 'delivery' && !deliveryAddress.trim()) {
                        sonner_1.toast.error("Address required", { description: "Please provide a delivery address." });
                        return [2 /*return*/];
                    }
                    cleanedPhone = (0, utils_1.normalizePhoneNumber)(phoneNumber);
                    if (!(0, utils_1.isValidMpesaPhone)(phoneNumber) || !cleanedPhone) {
                        sonner_1.toast.error("Invalid phone number", { description: "Enter a Kenyan M-Pesa number like +254712345678, 0712345678, or 712345678." });
                        return [2 /*return*/];
                    }
                    setProcessing(true);
                    setCurrentOrderId(null); // Reset current order ID for a new transaction
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/pos/create-order/"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                items: cart.map(function (item) { return ({
                                    menu_item_id: item.menu_item_id || item.id || undefined,
                                    name: item.name,
                                    price: item.price,
                                    quantity: item.quantity,
                                    modifiers: item.modifiers || [],
                                }); }),
                                phone: cleanedPhone,
                                order_type: orderType,
                                delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : "",
                                payment_method: "mpesa",
                            }),
                        })];
                case 2:
                    response = _c.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    dataRes = _c.sent();
                    errorMessage = (dataRes === null || dataRes === void 0 ? void 0 : dataRes.message) || (dataRes === null || dataRes === void 0 ? void 0 : dataRes.error);
                    if (!response.ok) {
                        setProcessing(false); // Ensure processing is reset on error
                        if ((dataRes === null || dataRes === void 0 ? void 0 : dataRes.error) === 'schema_not_ready') {
                            throw new Error('Payments are temporarily unavailable. Please try again later.');
                        }
                        if ((dataRes === null || dataRes === void 0 ? void 0 : dataRes.error) === 'stk_push_failed') {
                            throw new Error(((_a = dataRes.details) === null || _a === void 0 ? void 0 : _a.message) || 'M-Pesa initiation failed. Try again.');
                        }
                        throw new Error(errorMessage || "Failed to initiate payment");
                    }
                    checkoutId_1 = (_b = dataRes.stk_response) === null || _b === void 0 ? void 0 : _b.CheckoutRequestID;
                    if (!checkoutId_1) {
                        throw new Error(errorMessage || "M-Pesa STK Push could not be initiated. Try again.");
                    }
                    setCurrentOrderId(dataRes.order_id); // Store the order ID
                    setProcessing(false);
                    setAwaitingMpesaConfirm(true);
                    sonner_1.toast.info("M-Pesa Push Sent", { description: "Check your phone for the M-Pesa prompt." });
                    transactionSettled_1 = false;
                    checkPaymentStatus_1 = function () { return __awaiter(void 0, void 0, void 0, function () {
                        var statusRes, statusData, newPoints, trackingId_1, orderDetails, e_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (transactionSettled_1)
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
                                        clearTimers();
                                        // Loyalty logic: Orders > 1000 gain 10 points
                                        if (cartTotalPrice > 1000) {
                                            newPoints = points + 10;
                                            setPoints(newPoints);
                                            localStorage.setItem('loyaltyPoints', newPoints.toString());
                                        }
                                        trackingId_1 = Math.floor(10000 + Math.random() * 90000).toString();
                                        orderDetails = {
                                            order_id: trackingId_1,
                                            items: cart,
                                            total_amount: cartTotalPrice,
                                            payment_method: "mpesa",
                                            order_type: "takeaway", // Added to satisfy OrderReceipt interface
                                            table_number: "",
                                            delivery_address: orderType === 'delivery' ? deliveryAddress : undefined,
                                            cashier_notified: true,
                                        };
                                        setLastOrder(orderDetails);
                                        setShowCartModal(false);
                                        setCart([]);
                                        setPhoneNumber('');
                                        setCurrentOrderId(null); // Clear order ID after successful payment
                                        setAwaitingMpesaConfirm(false);
                                        sonner_1.toast.success("Payment Received!", {
                                            description: "Order #".concat(trackingId_1, " is now being prepared. Save this ID for tracking."),
                                            action: {
                                                label: "Track Order",
                                                onClick: function () { return navigate("/track/".concat(trackingId_1)); }
                                            }
                                        });
                                    }
                                    else if (statusData.status === "failed") {
                                        transactionSettled_1 = true;
                                        clearTimers();
                                        setAwaitingMpesaConfirm(false);
                                        sonner_1.toast.error("Payment Failed", { description: "The M-Pesa transaction was cancelled or failed." });
                                        // Optionally discard order on backend if payment failed
                                    }
                                    _a.label = 4;
                                case 4: return [3 /*break*/, 6];
                                case 5:
                                    e_1 = _a.sent();
                                    return [3 /*break*/, 6];
                                case 6:
                                    if (!transactionSettled_1) {
                                        pollTimerRef.current = setTimeout(checkPaymentStatus_1, 2000);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    pollTimerRef.current = setTimeout(checkPaymentStatus_1, 2000);
                    safetyTimeoutRef.current = setTimeout(function () {
                        if (!transactionSettled_1) {
                            transactionSettled_1 = true;
                            clearTimers();
                            setAwaitingMpesaConfirm(false);
                            sonner_1.toast.error("Payment Timeout", { description: "We didn't receive your payment in time. Please try again." });
                        }
                    }, 60000);
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _c.sent();
                    message = (err_2 === null || err_2 === void 0 ? void 0 : err_2.message) || 'Unable to complete payment. Please try again.';
                    sonner_1.toast.error("Order Failed", { description: message });
                    setProcessing(false);
                    setAwaitingMpesaConfirm(false);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCancelMpesaTransaction = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clearTimers(); // Stop polling
                    if (!currentOrderId) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetch((0, api_1.getApiUrl)("/payments/orders/".concat(encodeURIComponent(currentOrderId), "/discard/")), {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                        })];
                case 2:
                    _a.sent();
                    sonner_1.toast.info("Order Discarded", { description: "Order ".concat(currentOrderId, " has been cancelled.") });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("Failed to discard order on backend:", error_1);
                    sonner_1.toast.error("Cancellation Error", { description: "Could not discard order on server, please contact support." });
                    return [3 /*break*/, 4];
                case 4:
                    setProcessing(false);
                    setAwaitingMpesaConfirm(false);
                    setCurrentOrderId(null);
                    sonner_1.toast.info("Payment Cancelled", { description: "The M-Pesa payment process has been stopped." });
                    return [2 /*return*/];
            }
        });
    }); };
    if (loading)
        return <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">Loading Experience...</div>;
    if (!data)
        return <div className="min-h-screen bg-black flex items-center justify-center text-white text-lg">No menu data received. Check backend.</div>;
    return (<div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-orange-500/30">
      {/* Global Page Background Image */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img src={hero_food_jpg_1.default} alt="" className="w-full h-full object-cover opacity-[0.03] scale-110 blur-[2px]"/>
      </div>

      {/* Cart Modal */}
      {showCartModal && (<CartModal_1.default cart={cart} currency={data.config.currency} onClose={function () { return setShowCartModal(false); }} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} onCheckout={handleCheckout} cartTotalPrice={cartTotalPrice} cartTotalItems={cartTotalItems} phoneNumber={phoneNumber} onPhoneNumberChange={setPhoneNumber} isProcessing={processing} isAwaitingMpesa={awaitingMpesaConfirm} onCancelMpesaPayment={handleCancelMpesaTransaction} // Pass the new handler
         points={points} onRedeemPoints={handleRedeemPoints} orderType={orderType} onOrderTypeChange={setOrderType} deliveryAddress={deliveryAddress} onDeliveryAddressChange={setDeliveryAddress}/>)}

      {/* Receipt Modal */}
      {lastOrder && (<Receipt_1.default order={lastOrder} onClose={function () { return setLastOrder(null); }}/>)}

      {/* Glassmorphic Navbar */}
      <nav className={"fixed top-0 w-full z-50 transition-all duration-500 ".concat(scrolled ? 'py-4 bg-black/60 backdrop-blur-xl border-b border-white/10' : 'py-6 bg-transparent', " ").concat(showCartModal || lastOrder ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <h2 onClick={scrollToTop} className="text-2xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent italic cursor-pointer transition-opacity hover:opacity-80">
            TASTY BITES<span className="text-orange-500 text-sm not-italic ml-1">PRO</span>
          </h2>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <button onClick={function () { return data && scrollToCategory(data.categories[0]); }} className="hover:text-white transition-colors">
              Menu
            </button>
            <button onClick={handleRewardsClick} className="hover:text-white transition-colors">Rewards</button>
            <a href="#about" className="hover:text-white transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
            <react_router_dom_1.Link to="/track" className="hover:text-white transition-colors">My Orders</react_router_dom_1.Link>
            <react_router_dom_1.Link to="/account" className="hover:text-white transition-colors">Account</react_router_dom_1.Link>
          </div>
          <button onClick={function () { return setShowCartModal(true); }} className="p-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-orange-500 transition-all group relative">
            <lucide_react_1.ShoppingCart size={20} className="group-hover:scale-110 transition-transform"/>
            {cartTotalItems > 0 && (<span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {cartTotalItems}
              </span>)}
          </button>
        </div>
      </nav>

      {/* Hero Section with Premium Brand Presentation */}
      <header id="home" className={"relative min-h-[85vh] flex items-center justify-center overflow-hidden transition-opacity duration-500 ".concat(showCartModal || lastOrder ? 'opacity-20 pointer-events-none' : 'opacity-100')}>
        <img src={hero_food_jpg_1.default || data.hero.image_url} className="absolute inset-0 w-full h-full object-cover object-center scale-[1.08] transition-transform duration-1000" alt="Hero"/>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-black/50 to-slate-950/95"/>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.16),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_18%)] pointer-events-none"/>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center text-center gap-9 py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-5 py-3 text-xs uppercase tracking-[0.35em] text-orange-300 shadow-lg shadow-orange-500/10 backdrop-blur-xl">
              <lucide_react_1.MapPin size={14}/> Now Delivering to your Location
            </div>

            <div className="space-y-6">
              <p className="text-sm uppercase tracking-[0.45em] text-orange-400 opacity-90">Premium food service, refined</p>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-tight font-hero">{data.hero.title}</h1>
              <p className="mx-auto max-w-3xl text-base sm:text-lg md:text-xl text-slate-300 leading-relaxed font-hero-sub">{data.hero.tagline} Discover a polished ordering experience tailored for modern restaurants and professional service.</p>
            </div>

            <div className="w-full max-w-3xl rounded-[2.5rem] border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-center">
                <div className="relative">
                  <lucide_react_1.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input type="text" placeholder="Search the menu..." value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }} onKeyDown={function (e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(function (s) { return Math.min(s + 1, suggestions.length - 1); });
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(function (s) { return Math.max(s - 1, 0); });
            }
            else if (e.key === 'Enter') {
                if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                    var sel = suggestions[activeSuggestion];
                    setSearchQuery(sel.name);
                    scrollToCategory(sel.category);
                }
            }
        }} className="w-full rounded-3xl border border-white/10 bg-white/5 py-4 pl-14 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-orange-400 focus:bg-white/10 focus:ring-2 focus:ring-orange-500/15 transition"/>

                    {suggestions.length > 0 && (<div className="absolute left-0 right-0 mt-2 z-50">
                        <div className="bg-slate-900/95 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                          {suggestions.map(function (s, i) { return (<button key={s.id} onMouseDown={function (ev) { ev.preventDefault(); setSearchQuery(s.name); scrollToCategory(s.category); setSuggestions([]); }} className={"w-full text-left px-4 py-3 hover:bg-slate-800 transition flex items-center justify-between ".concat(i === activeSuggestion ? 'bg-slate-800' : '')}>
                              <div>
                                <div className="font-semibold text-white truncate max-w-[320px]">{s.name}</div>
                                <div className="text-xs text-slate-400">{s.category} • {(0, utils_2.formatCurrency)(s.price, data.config.currency)}</div>
                              </div>
                              <div className="text-slate-400 text-xs">Add</div>
                            </button>); })}
                        </div>
                      </div>)}
                </div>
                <button onClick={function () { return scrollToCategory(data.categories[0]); }} className="inline-flex items-center justify-center rounded-3xl bg-orange-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400">
                  Find Food
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button type="button" onClick={function () { return scrollToCategory(data.categories[0]); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Browse Menu</button>
                <button type="button" onClick={handleRewardsClick} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Rewards</button>
                <react_router_dom_1.Link to="/track" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">My Orders</react_router_dom_1.Link>
              </div>
              <div className="mt-4 overflow-x-auto no-scrollbar">
                <div className="flex gap-4 py-2">
                  {data.categories.map(function (cat, idx) { return (<button key={cat} onClick={function () { return scrollToCategory(cat); }} className={"whitespace-nowrap px-6 py-2 rounded-2xl border transition-all duration-300 font-bold ".concat(idx === 0 ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10')}>
                      {cat}
                    </button>); })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="menu" className={"scroll-mt-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20 transition-opacity duration-500 ".concat(showCartModal || lastOrder ? 'opacity-20 pointer-events-none' : 'opacity-100')}>

        {/* Featured Section */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-black flex items-center gap-3 tracking-tight">
              <lucide_react_1.Flame className="text-orange-500 fill-orange-500"/> Trending Now
            </h3>
          </div>
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.featured.map(function (item) { return ( // Pass onAdd to ProItemCard
        <ProItemCard key={item.id} item={item} currency={data.config.currency} onAdd={function () { return handleAddToCart(item); }} formatImageUrl={image_1.formatImageUrl}/>); })}
          </div>
        </section>

        {/* Category Grids */}
        {(function () {
            var q = searchQuery.trim().toLowerCase();
            if (q.length > 0) {
                // collect matched items across categories
                var matched = [];
                for (var _i = 0, _a = data.categories; _i < _a.length; _i++) {
                    var cat = _a[_i];
                    var items = data.menu_by_category[cat] || [];
                    for (var _b = 0, items_1 = items; _b < items_1.length; _b++) {
                        var it = items_1[_b];
                        if (it.name.toLowerCase().includes(q) ||
                            it.description.toLowerCase().includes(q) ||
                            it.category.toLowerCase().includes(q)) {
                            matched.push(it);
                        }
                    }
                }
                if (matched.length > 0) {
                    // determine most common category among matches
                    var counts_1 = {};
                    for (var _c = 0, matched_1 = matched; _c < matched_1.length; _c++) {
                        var m = matched_1[_c];
                        counts_1[m.category] = (counts_1[m.category] || 0) + 1;
                    }
                    var primaryCategory_1 = Object.keys(counts_1).sort(function (a, b) { return counts_1[b] - counts_1[a]; })[0];
                    // render only that category (show full category list)
                    var items = data.menu_by_category[primaryCategory_1] || [];
                    return (<section key={primaryCategory_1} className="mb-20">
                  <div id={"category-".concat(primaryCategory_1)} className="flex items-center gap-4 mb-10">
                    <h4 className="text-4xl font-black tracking-tight italic uppercase">{primaryCategory_1}</h4>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-white/20 to-transparent"/>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items
                            .filter(function (i) { return !featuredIds.has(i.id); })
                            .map(function (item, index) { return (<ProItemCard key={"".concat(primaryCategory_1, "-").concat(item.id, "-").concat(index)} item={item} currency={data.config.currency} compact onAdd={function () { return handleAddToCart(item); }} formatImageUrl={image_1.formatImageUrl}/>); })}
                  </div>
                </section>);
                }
            }
            // default: render all categories with item-level filtering
            return data.categories.map(function (category) {
                var items = data.menu_by_category[category] || [];
                return (<section key={category} className="mb-20">
                <div id={"category-".concat(category)} className="flex items-center gap-4 mb-10">
                  <h4 className="text-4xl font-black tracking-tight italic uppercase">{category}</h4>
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-white/20 to-transparent"/>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items
                        .filter(function (i) { return !featuredIds.has(i.id); })
                        .filter(function (i) {
                        return i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.category.toLowerCase().includes(searchQuery.toLowerCase());
                    })
                        .map(function (item, index) { return (<ProItemCard key={"".concat(category, "-").concat(item.id, "-").concat(index)} item={item} currency={data.config.currency} compact onAdd={function () { return handleAddToCart(item); }} formatImageUrl={image_1.formatImageUrl}/>); })}
                </div>
              </section>);
            });
        })()}
      </main>

      <div className={"transition-opacity duration-500 ".concat(showCartModal || lastOrder ? 'opacity-20 pointer-events-none' : 'opacity-100')}>
        <About_1.default />
        <Contact_1.default />
        <Footer_1.default />
      </div>
    </div>);
};
var ProItemCard = function (_a) {
    var item = _a.item, currency = _a.currency, compact = _a.compact, onAdd = _a.onAdd, formatImageUrl = _a.formatImageUrl;
    return (<div className="group relative bg-white/10 border border-white/10 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-2xl shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/15">
    <div className={"relative ".concat(compact ? 'h-24' : 'h-32 sm:h-36', " overflow-hidden")}>
      <img src={item.image_url ? formatImageUrl(item.image_url) : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'} onError={function (event) { event.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'; }} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.name}/>
      <div className="absolute top-3 left-3 flex flex-wrap gap-1">
        {item.popular && <span className="rounded-full bg-orange-500/15 text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200 border border-orange-500/30 px-2 py-1">Pop</span>}
        {item.spicy && <span className="rounded-full bg-red-500/15 text-[10px] font-bold uppercase tracking-[0.24em] text-red-200 border border-red-500/30 px-2 py-1">Hot</span>}
      </div>
    </div>
    
    <div className="p-3 space-y-2 min-h-[128px] flex flex-col justify-between">
      <div className="space-y-1">
        <h5 className="text-sm sm:text-sm font-semibold text-white group-hover:text-orange-300 transition-colors line-clamp-1">{item.name}</h5>
        <p className="text-sm font-bold text-orange-400">{(0, utils_2.formatCurrency)(item.price, currency)}</p>
      </div>
      <div className="space-y-2">
        <p className="text-slate-300 text-[11px] leading-snug line-clamp-2">{item.description}</p>
        <button onClick={function (e) { e.stopPropagation(); onAdd(); }} className="w-full rounded-2xl bg-slate-900/95 text-white font-semibold text-[11px] py-2 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-orange-500 hover:text-white">
          <lucide_react_1.ShoppingCart size={14}/> Add
        </button>
      </div>
    </div>
  </div>);
};
exports.default = ProfessionalCustomerHome;
