class MyBlock:
    
    def __init__(self, config):
        
        self.config = config
        
    def initialize(self):
        
        print(f"Initializing with config: {self.config}")
    
    def compute(self, inputs, t):
        
        output = inputs[0]**2
        
        return [output]