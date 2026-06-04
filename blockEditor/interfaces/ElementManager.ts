import { JsonData } from "../../shared/JsonTypes";



export abstract class ElementManager {

    abstract updateFromJson(json: JsonData): void;

}