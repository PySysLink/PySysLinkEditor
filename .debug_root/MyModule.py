class MyBlock:
    
    def __init__(self, config):
        
        self.config = config
        
    def initialize(self):
        
        print(f"Initializing with config on debug_root: {self.config}")
    
    def compute(self, inputs, t):
        
        output = inputs[0]**2
        
        return [output]