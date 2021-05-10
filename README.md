# Virtual Dollar (DV)

A stablecoin pegged to the US Dollar, backed by interest-generating collateral.

## Setup

1. Install 

   ```sh
   git clone https://github.com/vesperfi/dv-stablecoin.git
   cd dv-stablecoin
   npm install
   ```
2. set NODE_URL in env
    ```sh
    export NODE_URL=<eth mainnet url>
    ```
    Or
    Use .env file
    ```sh
    touch .env
    # Edit .env file and add NODE_URL
    NODE_URL=<eth mainnet url>
    ```

3. Test
> These tests will run on mainnet fork, which already configured no extra steps needed.

   ```sh
   npm test
   ```

4. Run test with coverage

```sh
npm run coverage
```