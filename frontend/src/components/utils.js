"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = void 0;
var formatCurrency = function (value, currencyCode) {
    if (currencyCode === void 0) { currencyCode = "KES"; }
    var locale = currencyCode === "KES" ? "en-KE" : "en-US";
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(value);
};
exports.formatCurrency = formatCurrency;
