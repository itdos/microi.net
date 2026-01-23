// Pinia Store - Error Log
import { defineStore } from "pinia";

export const useErrorLogStore = defineStore("errorLog", {
    state: () => ({
        logs: []
    }),

    actions: {
        addErrorLog(log) {
            this.logs.push(log);
        },

        clearErrorLog() {
            this.logs.splice(0);
        }
    }
});
