export type TypeENV = "DEV" | "UAT" | "SIT" | "PROD" | "MOCK";

export interface IClientConfig {
    host: { [P in TypeENV]: string };
    port: number;
}
