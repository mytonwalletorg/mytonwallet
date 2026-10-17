package org.mytonwallet.app_air.walletcore.moshi

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mytonwallet.app_air.walletcore.helpers.ExplorerHelpers
import org.mytonwallet.app_air.walletcore.models.blockchain.MBlockchain
import org.mytonwallet.app_air.walletcore.models.blockchain.MBlockchainExplorer

class ExplorerTxHashTest {
    private val moshi = MoshiBuilder.build()

    @Test
    fun summarySwapIsLinkedByItsTraceIdOnceKnown() {
        val swap = decodeSwap(""""externalMsgHashNorm": "message-hash", "traceId": "trace-id",""")

        assertEquals("trace-id", swap.traceId)
        assertEquals("trace-id", swap.getExplorerTxHash())
    }

    @Test
    fun summarySwapWithoutTraceIdIsLinkedByItsMessageHash() {
        val swap = decodeSwap(""""externalMsgHashNorm": "message-hash",""")

        assertEquals(null, swap.traceId)
        assertEquals("message-hash", swap.getExplorerTxHash())
    }

    @Test
    fun swapThatLearnsItsExplorerHashCountsAsChanged() {
        val bare = decodeSwap("")

        assertTrue(decodeSwap(""""traceId": "trace-id",""").isChanged(bare))
        assertTrue(decodeSwap(""""externalMsgHashNorm": "message-hash",""").isChanged(bare))
        assertFalse(decodeSwap("").isChanged(bare))
    }

    @Test
    fun summarySwapWithoutAnyHashHasNoTransactionToLink() {
        val swap = decodeSwap("")

        assertEquals(null, swap.getExplorerTxHash())
    }

    @Test
    fun hashWithoutTraceIdOpensOnlyExplorersThatFindMessageHashes() {
        assertEquals(
            listOf(MBlockchainExplorer.TONSCAN, MBlockchainExplorer.TONVIEWER),
            ExplorerHelpers.transactionExplorers(MBlockchain.ton, isTraceId = false)
        )
        assertEquals(
            MBlockchain.ton.transactionExplorers(),
            ExplorerHelpers.transactionExplorers(MBlockchain.ton, isTraceId = true)
        )
        assertEquals(
            MBlockchain.ethereum.transactionExplorers(),
            ExplorerHelpers.transactionExplorers(MBlockchain.ethereum, isTraceId = false)
        )
    }

    private fun decodeSwap(fields: String): MApiTransaction.Swap {
        val json = """
            {
              "id": "2551567::backend-swap", "kind": "swap", "timestamp": 1, $fields
              "from": "toncoin", "to": "toncoin", "fromAmount": "1", "toAmount": "1",
              "status": "completed", "transactionIds": {}
            }
        """.trimIndent()
        return moshi.adapter(MApiTransaction::class.java).fromJson(json) as MApiTransaction.Swap
    }
}
