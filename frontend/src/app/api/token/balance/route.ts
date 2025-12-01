import { NextRequest, NextResponse } from "next/server";
import { getPublicClient } from "@/lib/viem";
import { formatUnits } from "viem";

/**
 * GET /api/token/balance?userAddress=0x...&tokenAddress=0x...&chainId=31337
 * Get ERC20 token balance for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get("userAddress");
    const tokenAddress = searchParams.get("tokenAddress");
    const chainIdParam = searchParams.get("chainId");

    if (!userAddress || !tokenAddress || !chainIdParam) {
      return NextResponse.json(
        { error: "Missing required parameters: userAddress, tokenAddress, chainId" },
        { status: 400 }
      );
    }

    const chainId = parseInt(chainIdParam, 10);
    if (isNaN(chainId)) {
      return NextResponse.json(
        { error: "Invalid chainId parameter" },
        { status: 400 }
      );
    }

    // Get appropriate public client for the chain
    let client;
    try {
      client = getPublicClient(chainId);
    } catch (err) {
      console.error(`Error creating client for chainId ${chainId}:`, err);
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported chain: ${chainId}`,
          formattedBalance: "0",
        },
        { status: 200 }
      );
    }

    // ERC20 ABI minimal for balanceOf
    const ERC20_ABI = [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const;

    // Call balanceOf on the token contract with timeout (5 seconds)
    const balancePromise = client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [userAddress as `0x${string}`],
    });

    // Set timeout for balance fetch (5 seconds)
    const balance = await Promise.race([
      balancePromise,
      new Promise<bigint>((_, reject) =>
        setTimeout(() => reject(new Error("RPC timeout")), 5000)
      ),
    ]) as bigint;

    // Format with 18 decimals
    const formattedBalance = formatUnits(balance, 18);

    return NextResponse.json({
      success: true,
      userAddress,
      tokenAddress,
      balance: balance.toString(),
      formattedBalance,
    });
  } catch (error) {
    console.error("Error fetching token balance:", error);

    // Return graceful error response - don't block UI
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch balance",
        formattedBalance: "0",
      },
      { status: 200 } // Return 200 to not block UI
    );
  }
}
