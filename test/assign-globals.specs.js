import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'

chai.use(chaiAsPromised);

Object.assign(global, {
    assert: chai.assert,
    expect: chai.expect,
    sinon
});

export default {}
