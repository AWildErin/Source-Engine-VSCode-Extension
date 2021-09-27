// ==========================================================================
// Purpose:
// Tests to validate the shader parameter default config.
// 
// Author: Stefan Heinz
//
// https://github.com/StefanH-AT/Source-Engine-VSCode-Extension
// ==========================================================================

import { ShaderParam } from './shader-param'
const packageJson = require('../package.json');

// This is a pretty dirty unit test. It's more of a method to validate the configuration.
test("Validate shader param config in package.json", () => {
    const params = packageJson.contributes.configuration.properties["sourceEngine.shaderParameters"].default;
    
    let i = 0;
    params.forEach((p: any) => {
        expect(p.name).toBeDefined();
        expect(p.type).toBeDefined();
        i++;
    });

});