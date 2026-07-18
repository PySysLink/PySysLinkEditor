import { JsonData } from "../../shared/JsonTypes";
import { Selectable } from "./Selectable";


export abstract class Copiable extends Selectable {
    
    public abstract copy(selectedSelectables: Selectable[], communicationManager: any): JsonData;

}
