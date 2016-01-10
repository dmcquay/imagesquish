import parseDefinition from './parse-definition'

describe('parseDefinition', function() {
    it('works for single operation with parameters', function() {
        assert.deepEqual(parseDefinition('otf:resize(100,100)'), [
            {operation: 'resize', params: ["100", "100"]}
        ]);
    });

    it('works for single operation with parens but not parameters', function() {
        assert.deepEqual(parseDefinition('otf:autoOrient()'), [
            {operation: 'autoOrient', params: []}
        ]);
    });

    it('works for single operation without or parameters', function() {
        assert.deepEqual(parseDefinition('otf:autoOrient'), [
            {operation: 'autoOrient', params: []}
        ]);
    });

    it('works for multiple operations', function() {
        assert.deepEqual(parseDefinition('otf:autoOrient:resize(100,200)'), [
            {operation: 'autoOrient', params: []},
            {operation: 'resize', params: ["100", "200"]}
        ]);
    });
});
