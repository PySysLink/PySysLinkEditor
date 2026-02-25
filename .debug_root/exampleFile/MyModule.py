import math

class MyBlock:
    
    def __init__(self, config):
        
        self.config = config
        
    def initialize(self):
        
        print(f"Initializing with config on exampleFile: {self.config}")
    
    def compute(self, inputs, t):
        
        output = math.sqrt(inputs[0])
        
        return [output]
    
