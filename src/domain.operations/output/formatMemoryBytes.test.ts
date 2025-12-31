import { given, when, then } from 'test-fns';

import { formatMemoryBytes } from './formatMemoryBytes';

describe('formatMemoryBytes', () => {
  given('bytes value', () => {
    when('value is 0', () => {
      then('returns "0 B"', () => {
        expect(formatMemoryBytes({ bytes: 0 })).toEqual('0 B');
      });
    });

    when('value is negative', () => {
      then('returns "0 B"', () => {
        expect(formatMemoryBytes({ bytes: -100 })).toEqual('0 B');
      });
    });

    when('value is less than 1 KB', () => {
      then('returns value in B', () => {
        expect(formatMemoryBytes({ bytes: 500 })).toEqual('500 B');
        expect(formatMemoryBytes({ bytes: 1 })).toEqual('1 B');
        expect(formatMemoryBytes({ bytes: 1023 })).toEqual('1023 B');
      });
    });

    when('value is exactly 1 KB', () => {
      then('returns "1.00 KB"', () => {
        expect(formatMemoryBytes({ bytes: 1024 })).toEqual('1.00 KB');
      });
    });

    when('value is in KB range', () => {
      then('returns formatted KB with 2 decimals', () => {
        expect(formatMemoryBytes({ bytes: 1536 })).toEqual('1.50 KB');
        expect(formatMemoryBytes({ bytes: 10240 })).toEqual('10.00 KB');
        expect(formatMemoryBytes({ bytes: 512 * 1024 })).toEqual('512.00 KB');
      });
    });

    when('value is exactly 1 MB', () => {
      then('returns "1.00 MB"', () => {
        expect(formatMemoryBytes({ bytes: 1024 * 1024 })).toEqual('1.00 MB');
      });
    });

    when('value is in MB range', () => {
      then('returns formatted MB with 2 decimals', () => {
        expect(formatMemoryBytes({ bytes: 1.5 * 1024 * 1024 })).toEqual(
          '1.50 MB',
        );
        expect(formatMemoryBytes({ bytes: 45.2 * 1024 * 1024 })).toEqual(
          '45.20 MB',
        );
        expect(formatMemoryBytes({ bytes: 512 * 1024 * 1024 })).toEqual(
          '512.00 MB',
        );
      });
    });

    when('value is exactly 1 GB', () => {
      then('returns "1.00 GB"', () => {
        expect(formatMemoryBytes({ bytes: 1024 * 1024 * 1024 })).toEqual(
          '1.00 GB',
        );
      });
    });

    when('value is in GB range', () => {
      then('returns formatted GB with 2 decimals', () => {
        expect(formatMemoryBytes({ bytes: 2.5 * 1024 * 1024 * 1024 })).toEqual(
          '2.50 GB',
        );
      });
    });

    when('value is exactly 1 TB', () => {
      then('returns "1.00 TB"', () => {
        expect(
          formatMemoryBytes({ bytes: 1024 * 1024 * 1024 * 1024 }),
        ).toEqual('1.00 TB');
      });
    });
  });
});
