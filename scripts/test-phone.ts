
import { normalizePhoneNumber } from '../src/utils/phoneUtils';

const testCases = [
    '+12223334444',
    '+1 222 333 4444',
    '(222) 333-4444',
    '222-333-4444'
];

console.log('Running normalization tests...');
let failed = 0;

testCases.forEach(input => {
    try {
        const result = normalizePhoneNumber(input);
        if (result === '+12223334444') {
            console.log(`PASS: ${input} -> ${result}`);
        } else {
            console.error(`FAIL: ${input} -> ${result} (Expected +12223334444)`);
            failed++;
        }
    } catch (e) {
        console.error(`FAIL: ${input} threw error:`, e);
        failed++;
    }
});

if (failed === 0) {
    console.log('All tests passed!');
    process.exit(0);
} else {
    console.error(`${failed} tests failed.`);
    process.exit(1);
}
