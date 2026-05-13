"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcDeadline = calcDeadline;
function calcDeadline(periodStart, offsetDays, businessDaysOnly) {
    const deadline = new Date(periodStart);
    if (businessDaysOnly) {
        let added = 0;
        while (added < offsetDays) {
            deadline.setDate(deadline.getDate() + 1);
            const day = deadline.getDay();
            if (day !== 0 && day !== 6)
                added++; // skip weekend
        }
    }
    else {
        deadline.setDate(deadline.getDate() + offsetDays);
    }
    deadline.setHours(23, 59, 59, 999);
    return deadline;
}
//# sourceMappingURL=deadline.js.map