import { db, getAllPortfolios, getTransactionsByPortfolio, getWatchlistAssets } from '@/utils/db';
import { calculateHoldings } from '@/utils/portfolio-logic';
import { getAllTransactions } from '@/utils/db';

/**
 * AI Tools Definition
 * Mirrors the structure expected by OpenAI's function calling.
 */
export const TOOLS = [
    {
        type: "function",
        function: {
            name: "list_portfolios",
            description: "Lists all portfolios available in the user's account.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_portfolio_holdings",
            description: "Gets the current holdings (assets, quantities, values) for a specific portfolio. Use 'all' for the combined summary of all portfolios.",
            parameters: {
                type: "object",
                properties: {
                    portfolioId: {
                        type: "string",
                        description: "The ID of the portfolio to analyze. Use 'all' for the global view."
                    }
                },
                required: ["portfolioId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_asset_details",
            description: "Gets detailed information about a specific asset across all portfolios or a specific one.",
            parameters: {
                type: "object",
                properties: {
                    symbol: {
                        type: "string",
                        description: "The asset symbol (e.g., BTC, AAPL, EUR)."
                    },
                    portfolioId: {
                        type: "string",
                        description: "Optional portfolio ID context."
                    }
                },
                required: ["symbol"]
            }
        }
    }
];

/**
 * Runtime Execution of Tools
 */
export async function executeTool(name, args, context = {}) {
    const { prices, baseCurrency } = context;

    switch (name) {
        case 'list_portfolios':
            const portfolios = await getAllPortfolios();
            return portfolios.map(p => ({
                id: p.id,
                name: p.name,
                isWatchlist: p.isWatchlist,
                createdAt: p.createdAt
            }));

        case 'get_portfolio_holdings':
            const { portfolioId } = args;
            let transactions = [];

            // Note: This relies on the frontend passing the 'prices' state
            // because we can't easily fetch live prices inside this non-component file 
            // without duplicating the heavy logic from Dashboard.js
            if (!prices) {
                return { error: "Real-time market data is not available in this context. Please tell the user you checking their historical records." };
            }

            if (portfolioId === 'all') {
                transactions = await getAllTransactions();
            } else {
                transactions = await getTransactionsByPortfolio(parseInt(portfolioId) || portfolioId);
            }

            // If it's a watchlist we might need different logic, but calculateHoldings handles transactions.
            // For watchlists, 'transactions' are derived from watchlist assets in the Dashboard.
            // If the user asks for a watchlist, we might fail if we don't pass that context.
            // For now, let's assume 'transactions' are sufficient for standard portfolios.

            const holdings = calculateHoldings(transactions, prices, baseCurrency || 'USD');

            // Simplify output for LLM tokens
            return holdings.map(h => ({
                symbol: h.asset,
                name: h.name,
                amount: h.amount,
                value: h.value.toFixed(2),
                currency: h.quoteCurrency,
                dailyPnl: h.dailyPnl.toFixed(2),
                change24h: h.change24h.toFixed(2) + '%',
                allocation: 'Calculated by Agent' // Agent can calc this
            }));

        case 'get_asset_details':
            // Basic lookup
            return { info: "Asset details lookup is implied by holdings summary." };

        default:
            return { error: `Tool ${name} not found.` };
    }
}
