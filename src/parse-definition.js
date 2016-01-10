export default function(definitionStr) {
    let operations = definitionStr.split(':'),
        steps = [], parts;

    if (operations[0] === 'otf') {
        operations = operations.slice(1);
    }

    for (let operation of operations) {
        parts = operation.split(/[(),]/);
        while (parts[parts.length-1] === "") {
            parts.pop();
        }
        steps.push({
            "operation": parts.shift(),
            "params": parts
        });
    }
    return steps;
}